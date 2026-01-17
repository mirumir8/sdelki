const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const accessToken = process.env.ACCESS_TOKEN;
const subdomain = process.env.SUBDOMAIN;

// Очередь задач
const taskQueue = [];
let isProcessing = false;

// Обработчик очереди с задержками
async function processQueue() {
    if (isProcessing || taskQueue.length === 0) return;
    
    isProcessing = true;
    console.log(`Processing queue: ${taskQueue.length} tasks`);
    
    while (taskQueue.length > 0) {
        const leadId = taskQueue.shift();
        
        try {
            await updateLeadName(leadId);
            // Задержка между запросами - 1 секунда
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            console.error(`Failed to process lead ${leadId}:`, error.message);
            // При ошибке 429 - увеличиваем задержку
            if (error.message.includes('Too Many Requests')) {
                console.log('Rate limit hit, waiting 5 seconds...');
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }
    
    isProcessing = false;
    console.log('Queue processing completed');
}

async function updateContactPhone(leadId) {
    console.log(`\n--- Checking contacts for lead ${leadId} ---`);

    // Получаем сделку с embedded контактами
    const leadResponse = await fetch(`https://${subdomain}.amocrm.ru/api/v4/leads/${leadId}?with=contacts`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!leadResponse.ok) {
        console.log(`⚠️ Could not fetch lead contacts: ${leadResponse.status}`);
        return;
    }

    const lead = await leadResponse.json();
    const contacts = lead._embedded?.contacts || [];

    if (contacts.length === 0) {
        console.log('📭 No contacts found for this lead');
        return;
    }

    console.log(`📧 Found ${contacts.length} contact(s)`);

    // Обрабатываем каждый контакт
    for (const contactShort of contacts) {
        const contactId = contactShort.id;

        // Получаем полные данные контакта
        const contactResponse = await fetch(`https://${subdomain}.amocrm.ru/api/v4/contacts/${contactId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!contactResponse.ok) {
            console.log(`⚠️ Could not fetch contact ${contactId}: ${contactResponse.status}`);
            continue;
        }

        const contact = await contactResponse.json();
        const customFields = contact.custom_fields_values || [];

        // Ищем поле с ID 1018087
        const targetField = customFields.find(field => field.field_id === 1018087);

        if (!targetField) {
            console.log(`📋 Contact ${contactId}: field 1018087 not found`);
            continue;
        }

        // Проверяем и обновляем значение
        const values = targetField.values || [];
        let updated = false;
        const newValues = values.map(val => {
            const originalValue = val.value || '';
            if (originalValue.startsWith('@')) {
                const newValue = originalValue.substring(1).trim();
                console.log(`🔄 Contact ${contactId}, field 1018087:`);
                console.log(`   From: "${originalValue}"`);
                console.log(`   To:   "${newValue}"`);
                updated = true;
                return { ...val, value: newValue };
            }
            return val;
        });

        if (!updated) {
            console.log(`✅ Contact ${contactId}: field 1018087 - no @ symbol found`);
            continue;
        }

        // Обновляем контакт
        const updatePayload = {
            custom_fields_values: [
                {
                    field_id: 1018087,
                    values: newValues
                }
            ]
        };

        const updateResponse = await fetch(`https://${subdomain}.amocrm.ru/api/v4/contacts/${contactId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify(updatePayload)
        });

        if (!updateResponse.ok) {
            const errorText = await updateResponse.text();
            console.log(`❌ Failed to update contact ${contactId}:`, errorText);
            continue;
        }

        console.log(`✅ Successfully updated contact ${contactId}`);

        // Задержка между обновлениями контактов
        await new Promise(resolve => setTimeout(resolve, 500));
    }
}

async function updateLeadName(leadId) {
    console.log(`\n=== PROCESSING LEAD ${leadId} ===`);

    // Получаем данные сделки
    const leadResponse = await fetch(`https://${subdomain}.amocrm.ru/api/v4/leads/${leadId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    console.log('API Response status:', leadResponse.status);

    if (!leadResponse.ok) {
        const errorText = await leadResponse.text();
        console.log('API Error response:', errorText);
        throw new Error(`Failed to fetch lead: ${leadResponse.status} ${leadResponse.statusText}`);
    }

    const lead = await leadResponse.json();
    console.log('Lead data received:', { id: lead.id, name: lead.name });

    const originalName = lead.name || '';
    const newName = originalName.replace(/^Автосделка:\s*/, '').trim();

    // Обновляем название если изменилось
    if (originalName !== newName) {
        console.log(`🔄 Updating lead ${leadId}:`);
        console.log(`   From: "${originalName}"`);
        console.log(`   To:   "${newName}"`);

        // Обновляем название
        const updateResponse = await fetch(`https://${subdomain}.amocrm.ru/api/v4/leads/${leadId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({ name: newName })
        });

        if (!updateResponse.ok) {
            const errorText = await updateResponse.text();
            console.log('Update Error response:', errorText);
            throw new Error(`Failed to update lead: ${updateResponse.status} ${updateResponse.statusText}`);
        }

        const updateData = await updateResponse.json();
        console.log(`✅ Successfully updated lead ${leadId}`);
        console.log('Update response:', updateData);
    } else {
        console.log(`✅ No changes needed for lead name: "${originalName}"`);
    }

    // Обновляем контакты (удаляем @ из поля 1018087)
    await updateContactPhone(leadId);
}

app.post('/webhook', async (req, res) => {
    console.log('\n=== WEBHOOK RECEIVED ===');
    console.log('Time:', new Date().toISOString());
    console.log('Full body:', JSON.stringify(req.body, null, 2));
    
    try {
        if (!req.body.leads) {
            console.log('❌ Invalid request payload - no leads object');
            return res.status(200).send('No leads object (ignored)');
        }

        // Берём либо leads.add (создание), либо leads.status (смена статуса)
        const leadsArray = req.body.leads.add || req.body.leads.status;

        if (!Array.isArray(leadsArray) || leadsArray.length === 0) {
            console.log('❌ Invalid request payload - no leads.add or leads.status array');
            return res.status(200).send('No leads.add or leads.status (ignored)');
        }

        // Извлекаем все ID сделок
        const leadIds = leadsArray
            .map(lead => lead.id)
            .filter(id => id);

        if (leadIds.length === 0) {
            console.log('❌ No valid lead IDs found');
            return res.status(200).send('No valid lead IDs (ignored)');
        }

        console.log(`📥 Found ${leadIds.length} lead(s):`, leadIds);

        // Добавляем в очередь (избегаем дубликатов)
        leadIds.forEach(leadId => {
            if (!taskQueue.includes(leadId)) {
                taskQueue.push(leadId);
                console.log(`➕ Added lead ${leadId} to queue`);
            } else {
                console.log(`⚠️ Lead ${leadId} already in queue`);
            }
        });

        console.log(`📋 Current queue size: ${taskQueue.length}`);

        // Запускаем обработку очереди
        processQueue();

        res.status(200).send('OK');
        
    } catch (error) {
        console.error('❌ Webhook error:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Health endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        queueSize: taskQueue.length,
        isProcessing 
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.send('Sdelki webhook processor is running!');
});

const PORT = process.env.PORT || 3001;

const listener = app.listen(PORT, () => {
    console.log(`🚀 App is listening on port ${listener.address().port}`);
    console.log(`📅 Started at: ${new Date().toISOString()}`);
    console.log(`📍 Webhook URL: http://45.8.99.161:${listener.address().port}/webhook`);
});
