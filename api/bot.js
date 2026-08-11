/**
 * VERCEL SERVERLESS FUNCTION - TELEGRAM BOT (24/7)
 * Features:
 * 1. Numeric expense entry -> Ask for description (force_reply)
 * 2. Description reply -> Save & Confirm
 * 3. /hisobot command & Daily report summary
 * 4. WebApp button integration
 */

const https = require('https');

const BOT_TOKEN = '8699086796:AAEeqqySXI7fXkQmomMEskOWj_zeH9cnMDY';
const DEFAULT_WEB_APP_URL = 'https://telgram-vazifa-bot.vercel.app';

// Simple in-memory / state storage helper
const userExpensesStore = {}; // chatId -> array of { amount, description, date, time }

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

function parseAmount(text) {
    if (!text) return null;
    const cleanStr = text.replace(/\s+/g, '').replace(/,/g, '').replace(/uzs/gi, '').replace(/so'm/gi, '').replace(/som/gi, '');
    if (/^\d+(\.\d+)?$/.test(cleanStr)) {
        const num = parseFloat(cleanStr);
        return num > 0 ? num : null;
    }
    return null;
}

function formatMoney(amount) {
    return new Intl.NumberFormat('uz-UZ').format(amount) + ' UZS';
}

function getTodayStr() {
    const now = new Date();
    return now.toLocaleDateString('uz-UZ', { year: 'numeric', month: 'long', day: 'numeric' });
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(200).send(`Telegram Bot (24/7) is Active!`);
    }

    let update = req.body;
    if (typeof update === 'string') {
        try { update = JSON.parse(update); } catch (e) {}
    }

    if (!update || !update.message) {
        return res.status(200).send('OK');
    }

    const msg = update.message;
    const chatId = msg.chat.id;
    const text = (msg.text || '').trim();
    const firstName = msg.from ? msg.from.first_name : 'Foydalanuvchi';
    const host = req.headers.host || 'telgram-vazifa-bot.vercel.app';
    const webAppUrl = `https://${host}`;

    if (!userExpensesStore[chatId]) {
        userExpensesStore[chatId] = [];
    }

    try {
        // 1. /start or /help command
        if (text.startsWith('/start') || text.startsWith('/help')) {
            await sendTelegramApi('sendMessage', {
                chat_id: chatId,
                text: `Assalomu alaykum, <b>${escapeHtml(firstName)}</b>! 👋\n\n🌟 <b>Vazifalar & Harajatlar Botiga Xush Kelibsiz!</b>\n\n✨ <b>Qanday foydalaniladi?</b>\n1️⃣ Shunchaki harajat summasini yozing (masalan: <code>50000</code> yoki <code>15 000</code>).\n2️⃣ Bot sizdan nima uchun sarflanganini so'raydi.\n3️⃣ Izoh yozsangiz, avtomatik saqlaydi!\n\n📊 <b>/hisobot</b> - Kunlik harajatlar hisobotini ko'rish.\n🌐 <b>Web Sayt</b> - Interaktiv ilovani ochish.`,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🌐 Web Saytni Ochish', web_app: { url: webAppUrl } }],
                        [{ text: '📊 Bugungi Hisobot', callback_data: 'report' }]
                    ]
                }
            });
            return res.status(200).send('OK');
        }

        // 2. /hisobot or /report command
        if (text.startsWith('/hisobot') || text.startsWith('/report') || text.toLowerCase() === 'hisobot') {
            await sendDailyReport(chatId, firstName, webAppUrl);
            return res.status(200).send('OK');
        }

        // 3. REPLY TO AMOUNT (User provides description for previously entered amount)
        if (msg.reply_to_message && msg.reply_to_message.text) {
            const replyText = msg.reply_to_message.text;
            const match = replyText.match(/💰 Summa:\s*([\d\s,]+)\s*UZS/i) || replyText.match(/(\d[\d\s]*)\s*UZS/i);
            
            if (match) {
                const amountNum = parseAmount(match[1]);
                const description = text;

                if (amountNum && description) {
                    const newExpense = {
                        amount: amountNum,
                        description: description,
                        date: getTodayStr(),
                        time: new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })
                    };

                    userExpensesStore[chatId].push(newExpense);

                    await sendTelegramApi('sendMessage', {
                        chat_id: chatId,
                        text: `✅ <b>Harajat Saqlandi!</b>\n\n💵 <b>Summa:</b> ${formatMoney(amountNum)}\n📝 <b>Izoh:</b> ${escapeHtml(description)}\n📅 <b>Sana:</b> ${getTodayStr()}\n\n📊 Bugungi jami harajatlarni ko'rish uchun <b>/hisobot</b> deb yozing.`,
                        parse_mode: 'HTML',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '🌐 Web Saytda Ko\'rish', web_app: { url: webAppUrl } }]
                            ]
                        }
                    });
                    return res.status(200).send('OK');
                }
            }
        }

        // 4. AMOUNT DETECTION (User enters a number, e.g., 50000 or 50 000)
        const detectedAmount = parseAmount(text);
        if (detectedAmount) {
            await sendTelegramApi('sendMessage', {
                chat_id: chatId,
                text: `💰 Summa: <b>${formatMoney(detectedAmount)}</b>\n\n❓ Ushbu harajat <b>nima uchun sarflandi?</b>\n(Iltimos, ushbu xabarga <i>Javob / Reply</i> qilib izoh yozing, masalan: <i>Tushlik</i> yoki <i>Taksi</i>):`,
                parse_mode: 'HTML',
                reply_markup: {
                    force_reply: true
                }
            });
            return res.status(200).send('OK');
        }

        // 5. Default Response
        await sendTelegramApi('sendMessage', {
            chat_id: chatId,
            text: `💡 Harajat qo'shish uchun shunchaki summani yozing (masalan: <b>50000</b>).\n\nBugungi hisobotni ko'rish uchun <b>/hisobot</b> komandasini yuboring.`,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🌐 Web Saytni Ochish', web_app: { url: webAppUrl } }]
                ]
            }
        });

    } catch (err) {
        console.error("Bot logic error:", err);
    }

    return res.status(200).send('OK');
};

async function sendDailyReport(chatId, firstName, webAppUrl) {
    const list = userExpensesStore[chatId] || [];
    const todayStr = getTodayStr();
    const todayList = list.filter(item => item.date === todayStr);

    let totalSum = 0;
    let itemsText = '';

    if (todayList.length === 0) {
        itemsText = '<i>Bugun hali hech qanday harajat kiritilmadi.</i>';
    } else {
        todayList.forEach((item, index) => {
            totalSum += item.amount;
            itemsText += `\n${index + 1}. <b>${escapeHtml(item.description)}</b> — ${formatMoney(item.amount)} <i>(${item.time})</i>`;
        });
    }

    const reportMsg = `📊 <b>KUNLIK HARAJATLAR HISOBOTI</b>\n📅 <b>Sana:</b> ${todayStr}\n👤 <b>Foydalanuvchi:</b> ${escapeHtml(firstName)}\n\n💸 <b>Jami Harajat:</b> <code>${formatMoney(totalSum)}</code>\n\n📝 <b>Harajatlar Ro'yxati:</b>${itemsText}\n\nErtangi kuningiz barakali va omadli o'tsin! ✨`;

    await sendTelegramApi('sendMessage', {
        chat_id: chatId,
        text: reportMsg,
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: '🌐 Web Saytda Boshqarish', web_app: { url: webAppUrl } }]
            ]
        }
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
