const mqtt = require('mqtt');
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');

// Configuration variables
const MQTT_BROKER = '192.168.89.100';
const MQTT_PORT = 1883;
const MQTT_TOPICS = ['OpenwebRX/CLIENT', 'OpenwebRX/RX'];
const MQTT_USER = 'openwebrx';
const MQTT_PASSWORD = 'XXXX';

const TELEGRAM_TOKEN = 'XXXXXXXX:XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
const CHAT_ID = 'XXXXXXXX';

// Initialize logger
const logger = (message) => {
    console.log(new Date().toISOString() + ' - ' + message);
};

// Initialize Telegram bot
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// Function to get IP information
async function getIpInfo(ip) {
    try {
        const response = await axios.get(`http://ip-api.com/json/${ip}?fields=status,country,city,isp`);
        if (response.data.status === 'success') {
            return response.data;
        }
        return null;
    } catch (error) {
        logger('Error getting IP info:', error);
        return null;
    }
}

// Function to send message to Telegram
async function sendMessage(message) {
    try {
        await bot.sendMessage(CHAT_ID, message);
        logger('Message sent successfully');
    } catch (error) {
        logger('Failed to send message:', error);
    }
}

// MQTT client connection options
const options = {
    username: MQTT_USER,
    password: MQTT_PASSWORD,
    protocolVersion: 5,
};

// Connect to MQTT broker
const client = mqtt.connect(`mqtt://${MQTT_BROKER}:${MQTT_PORT}`, options);

client.on('connect', () => {
    logger('Connected to MQTT broker');
    MQTT_TOPICS.forEach(topic => {
        client.subscribe(topic, { qos: 1 });
        logger(`Subscribed to topic: ${topic}`);
    });
});

client.on('message', async (topic, message) => {
    try {
        const decodedPayload = JSON.parse(message.toString());

        if (topic === 'OpenwebRX/CLIENT') {
            if (decodedPayload.mode === 'CLIENT' && decodedPayload.state === 'Connected') {
                const ip = decodedPayload.ip.replace(/^::ffff:/, '');
                let messageText = `👤 Cliente Conectado\n🌐 IP: ${ip}`;

                const ipInfo = await getIpInfo(ip);
                if (ipInfo) {
                    messageText += `\n🏳️ País: ${ipInfo.country}\n🏢 Ciudad: ${ipInfo.city}\n📡 ISP: ${ipInfo.isp}`;
                } else {
                    messageText += '\nNo se pudo obtener información adicional de la IP';
                }

                await sendMessage(messageText);
            }
        } else if (topic === 'OpenwebRX/RX') {
            let messageText = '';
            for (const key in decodedPayload) {
                if (key === 'freq') {
                    messageText += `${key}: ${decodedPayload[key] / 1_000_000} MHz\n`;
                } else {
                    messageText += `${key}: ${decodedPayload[key]}\n`;
                }
            }

            await sendMessage(messageText);
        }
    } catch (error) {
        logger('Error processing message:', error);
    }
});

client.on('disconnect', () => {
    logger('Disconnected from MQTT broker');
});
