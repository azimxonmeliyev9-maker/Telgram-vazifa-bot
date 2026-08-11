/**
 * VERCEL SERVERLESS FUNCTION - TELEGRAM BOT WEBHOOK (24/7)
 * Bot Token: 8699086796:AAEeqqySXI7fXkQmomMEskOWj_zeH9cnMDY
 */

const https = require('https');

const BOT_TOKEN = '8699086796:AAEeqqySXI7fXkQmomMEskOWj_zeH9cnMDY';
const DEFAULT_WEB_APP_URL = 'https://telgram-vazifa-bot.vercel.app';

function sendTelegramApi(method, data) {
    return new Promise((resolve, reject) => {
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
            res.on('end', () => resolve(body));
        });

        req.on('error', (err) => reject(err));
        req.write(payload);
        req.end();
    });
}

module.exports = async (req, res) => {
    // Webhook activation check
    if (req.method !== 'POST') {
        return res.status(200).send(`Telegram Bot Webhook is Active (24/7)! Token: 8699086796`);
    }

    const update = req.body;
    if (!update || !update.message) {
        return res.status(200).send('OK');
    }

    const msg = update.message;
    const chatId = msg.chat.id;
    const text = msg.text || '';
    const firstName = msg.from ? msg.from.first_name : 'Foydalanuvchi';
    const host = req.headers.host || 'telgram-vazifa-bot.vercel.app';
    const webAppUrl = `https://${host}`;

    try {
        if (text.startsWith('/start') || text.startsWith('/help')) {
            await sendTelegramApi('sendMessage', {
                chat_id: chatId,
                text: `Assalomu alaykum, <b>${escapeHtml(firstName)}</b>!\n\n🌟 <b>Vazifalar & Harajatlar Boshqaruvi</b> botiga xush kelibsiz.\n\nKunlik harajatlaringizni kuzatish va vazifalaringizni rejalashtirish uchun pastdagi tugmani bosing:`,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: '🌐 Web Saytni Ochish',
                                web_app: { url: webAppUrl }
                            }
                        ]
                    ]
                }
            });
        } else {
            await sendTelegramApi('sendMessage', {
                chat_id: chatId,
                text: `Xabaringiz qabul qilindi! Ilovadan foydalanish uchun pastdagi tugmani bosing:`,
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: '🌐 Web Saytni Ochish',
                                web_app: { url: webAppUrl }
                            }
                        ]
                    ]
                }
            });
        }
    } catch (err) {
        console.error("Webhook processing error:", err);
    }

    return res.status(200).send('OK');
};

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
