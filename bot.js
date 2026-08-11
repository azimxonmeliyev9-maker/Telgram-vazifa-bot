/**
 * TELEGRAM BOT SERVER SCRIPT
 * Bot Token: 8699086796:AAEeqqySXI7fXkQmomMEskOWj_zeH9cnMDY
 */

const https = require('https');

const BOT_TOKEN = '8699086796:AAEeqqySXI7fXkQmomMEskOWj_zeH9cnMDY';
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;
const WEB_APP_URL = 'https://telgram-vazifa-bot.vercel.app'; // Vercel yoki local ngrok URL

let offset = 0;

console.log('🤖 Telegram Bot ishga tushdi...');

function sendTelegramApi(method, data) {
    const payload = JSON.stringify(data);
    const options = {
        hostname: 'api.telegram.org',
        path: `/bot${BOT_TOKEN}/${method}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        }
    };

    const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
            // response processed
        });
    });

    req.on('error', (err) => {
        console.error('API Error:', err.message);
    });

    req.write(payload);
    req.end();
}

function pollUpdates() {
    https.get(`${API_BASE}/getUpdates?offset=${offset}&timeout=20`, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            try {
                const response = JSON.parse(data);
                if (response.ok && response.result) {
                    response.result.forEach(update => {
                        offset = update.update_id + 1;
                        handleUpdate(update);
                    });
                }
            } catch (e) {
                // handle JSON error silently
            }
            pollUpdates();
        });
    }).on('error', (err) => {
        setTimeout(pollUpdates, 3000);
    });
}

function handleUpdate(update) {
    if (!update.message) return;
    const msg = update.message;
    const chatId = msg.chat.id;
    const text = msg.text || '';
    const firstName = msg.from ? msg.from.first_name : 'Foydalanuvchi';

    console.log(`💬 Xabar [${firstName}]: ${text}`);

    if (text.startsWith('/start') || text.startsWith('/help')) {
        sendTelegramApi('sendMessage', {
            chat_id: chatId,
            text: `Assalomu alaykum, <b>${firstName}</b>!\n\n🌟 <b>Vazifalar & Harajatlar Boshqaruvi</b> botiga xush kelibsiz.\n\nKunlik harajatlaringizni kuzatish va vazifalaringizni rejalashtirish uchun pastdagi tugmani bosing:`,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: '🌐 Web Saytni Ochish',
                            web_app: { url: WEB_APP_URL }
                        }
                    ]
                ]
            }
        });
    } else {
        sendTelegramApi('sendMessage', {
            chat_id: chatId,
            text: `Xabaringiz qabul qilindi! Ilovadan foydalanish uchun pastdagi tugmani bosing:`,
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: '🌐 Web Saytni Ochish',
                            web_app: { url: WEB_APP_URL }
                        }
                    ]
                ]
            }
        });
    }
}

// Botni polling rejimida ishga tushirish
pollUpdates();
