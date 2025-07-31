const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

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
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }
    
    isProcessing = false;
}

async function updateLeadName(leadId) {
    // Получаем данные сделки
    const leadResponse = await fetch(`https://${subdomain}.amocrm.ru/api/v4/leads/${leadId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (!leadResponse.ok) {
        throw new Error(`Failed to fetch lead: ${leadResponse.statusText}`);
    }
    
    const lead = await leadResponse.json();
    const originalName = lead.name;
    const newName = originalName.replace('Автосделка:', '').trim();
    
    // Если название не изменилось - пропускаем
    if (originalName === newName) {
        console.log(`No changes needed for lead ${leadId}: ${originalName}`);
        return;
    }
    
    console.log(`Updating lead ${leadId}: "${originalName}" -> "${newName}"`);
    
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
        throw new Error(`Failed to update lead: ${updateResponse.statusText}`);
    }
    
    const updateData = await updateResponse.json();
    console.log(`✅ Updated lead ${leadId}:`, updateData);
}

app.post('/webhook', async (req, res) => {
    console.log('=== WEBHOOK RECEIVED ===');
    console.log('Body:', req.body);
    
    try {
        if (!req.body.leads || !req.body.leads.add || !req.body.leads.add[0] || !req.body.leads.add[0].id) {
            return res.status(400).send('Invalid request payload');
        }
        
        const leadId = req.body.leads.add[0].id;
        
        // Добавляем в очередь (избегаем дубликатов)
        if (!taskQueue.includes(leadId)) {
            taskQueue.push(leadId);
            console.log(`Added lead ${leadId} to queue. Queue size: ${taskQueue.length}`);
        }
        
        // Запускаем обработку очереди
        processQueue();
        
        res.status(200).send('OK');
        
    } catch (error) {
        console.error('Webhook error:', error);
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

const listener = app.listen(process.env.PORT, () => {
    console.log(`Your app is listening on port ${listener.address().port}`);
});


