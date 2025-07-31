const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();

// Парсинг URL-кодированных данных
app.use(bodyParser.urlencoded({ extended: true }));

const accessToken = process.env.ACCESS_TOKEN;
const subdomain = process.env.SUBDOMAIN;

app.post('/update-deal-name', async (req, res) => {
    try {
        console.log('Received headers:', req.headers);
        console.log('Received body:', req.body);

        // Проверка, содержит ли тело запроса ожидаемые данные
        if (!req.body.leads || !req.body.leads.add || !req.body.leads.add[0] || !req.body.leads.add[0].id) {
            return res.status(400).send('Invalid request payload');
        }

        const leadId = req.body.leads.add[0].id;

        const leadResponse = await fetch(`https://${subdomain}.amocrm.ru/api/v4/leads/${leadId}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!leadResponse.ok) {
            throw new Error(`Failed to fetch lead: ${leadResponse.statusText}`);
        }

        const lead = await leadResponse.json();
        console.log('Lead data:', lead);

        const originalName = lead.name;
        const newName = originalName.replace('Автосделка:', '');
        console.log('Original name:', originalName, 'New name:', newName);

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
        console.log('Update response:', updateData);
        res.send(updateData);
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

const listener = app.listen(process.env.PORT, () => {
    console.log(`Your app is listening on port ${listener.address().port}`);
});


