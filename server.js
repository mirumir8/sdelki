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
    
    const originalName = lead.name;
    const newName = originalName.replace(/^Автосделка:\s*/, '').trim();
    
    // Если название не изменилось - пропускаем
    if (originalName === newName) {
        console.log(`✅ No changes needed for lead ${leadId}: "${originalName}"`);
        return;
    }
    
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
}

app.post('/webhook', async (req, res) => {
    console.log('\n=== WEBHOOK RECEIVED ===');
    console.log('Time:', new Date().toISOString());
    console.log('Full body:', JSON.stringify(req.body, null, 2));
    
    try {
        // Проверяем структуру данных
        if (!req.body.leads || !req.body.leads.add || !Array.isArray(req.body.leads.add) || req.body.leads.add.length === 0) {
            console.log('❌ Invalid request payload - no leads.add array');
            return res.status(400).send('Invalid request payload');
        }
        
        // Извлекаем все ID сделок
        const leadIds = req.body.leads.add.map(lead => lead.id).filter(id => id);
        
        if (leadIds.length === 0) {
            console.log('❌ No valid lead IDs found');
            return res.status(400).send('No valid lead IDs');
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

const listener = app.listen(process.env.PORT, () => {
    console.log(`🚀 App is listening on port ${listener.address().port}`);
    console.log(`📅 Started at: ${new Date().toISOString()}`);
});
