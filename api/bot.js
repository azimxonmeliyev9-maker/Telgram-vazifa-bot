/**
 * VERCEL SERVERLESS FUNCTION - TELEGRAM BOT (24/7)
 * Features:
 * 1. Password protection (code: 4321Azimjon)
 * 2. Auto-lock after 10 minutes of inactivity
 * 3. Bottom Reply Keyboard: Harajat & Vazifa tugmalari
 * 4. Expense flow: Summa -> Toifa -> Save
 * 5. Task flow: Sarlavha -> Muhimlik -> Save
 * 6. /hisobot - Daily Expense Report
 * 7. /vazifalar - Task list
 * 8. WebApp integration
 */

const https = require('https');

const BOT_TOKEN = '8699086796:AAEeqqySXI7fXkQmomMEskOWj_zeH9cnMDY';
const SECRET_CODE = '4321Azimjon';         // Kirish kodi
const AUTO_LOCK_MINUTES = 10;             // Avtomatik qulflash (daqiqa)

// ============================================================
// IN-MEMORY USER STORE
// ============================================================
const userStore = {};
// userStore[chatId] = {
//   authenticated: bool,
//   lastActivity: timestamp,
//   wrongAttempts: number,
//   state: null | 'awaiting_expense_amount' | 'awaiting_expense_desc' | 'awaiting_task_title' | 'awaiting_task_priority',
//   pendingAmount: null,
//   pendingTaskTitle: null,
//   expenses: [],
//   tasks: []
// }

function getUser(chatId) {
    if (!userStore[chatId]) {
        userStore[chatId] = {
            authenticated: false,
            lastActivity: null,
            wrongAttempts: 0,
            state: null,
            pendingAmount: null,
            pendingTaskTitle: null,
            expenses: [],
            tasks: []
        };
    }
    return userStore[chatId];
}

function isAuthenticated(user) {
    if (!user.authenticated) return false;
    if (!user.lastActivity) return false;
    const now = Date.now();
    const elapsed = (now - user.lastActivity) / 1000 / 60; // minutes
    if (elapsed >= AUTO_LOCK_MINUTES) {
        // Auto-lock
        user.authenticated = false;
        user.state = null;
        return false;
    }
    return true;
}

function refreshActivity(user) {
    user.lastActivity = Date.now();
}

// ============================================================
// TELEGRAM API HELPER
// ============================================================
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
            res.on('data', c => body += c);
            res.on('end', () => resolve(body));
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

// ============================================================
// HELPERS
// ============================================================
function parseAmount(text) {
    if (!text) return null;
    const clean = text.replace(/\s+/g,'').replace(/,/g,'').replace(/uzs/gi,'').replace(/so'm/gi,'').replace(/som/gi,'');
    if (/^\d+(\.\d+)?$/.test(clean)) {
        const n = parseFloat(clean);
        return n > 0 ? n : null;
    }
    return null;
}

function formatMoney(amount) {
    return new Intl.NumberFormat('uz-UZ').format(amount) + ' UZS';
}

function getTodayStr() {
    return new Date().toLocaleDateString('uz-UZ', { year: 'numeric', month: 'long', day: 'numeric' });
}

function getTimeStr() {
    return new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ============================================================
// KEYBOARDS
// ============================================================
const MAIN_KEYBOARD = {
    keyboard: [
        [
            { text: '💸 Harajat Qo\'shish' },
            { text: '✅ Vazifa Qo\'shish' }
        ],
        [
            { text: '📊 Kunlik Hisobot' },
            { text: '📋 Vazifalar Ro\'yxati' }
        ],
        [
            { text: '🌐 Web Saytni Ochish' }
        ]
    ],
    resize_keyboard: true,
    persistent: true
};

const LOCK_KEYBOARD = {
    keyboard: [
        [{ text: '🔐 Kodni Kiritish' }]
    ],
    resize_keyboard: true,
    persistent: true
};

// ============================================================
// SEND LOCK MESSAGE
// ============================================================
async function sendLockMessage(chatId, reason = 'new') {
    let lockText = '';
    if (reason === 'timeout') {
        lockText = `⏱ <b>10 daqiqa faoliyatsizlik</b> sababli bot avtomatik qulflandi.\n\n🔐 Davom etish uchun maxfiy kodni kiriting:`;
    } else {
        lockText = `🔐 <b>Salom!</b>\n\nBu bot shaxsiy himoyalangan.\nFoydalanish uchun <b>maxfiy kodni</b> kiriting:\n\n<i>To'g'ri kodni kiriting va botdan bemalol foydalaning.</i>`;
    }
    await sendTelegramApi('sendMessage', {
        chat_id: chatId,
        text: lockText,
        parse_mode: 'HTML',
        reply_markup: { remove_keyboard: true }
    });
}

// ============================================================
// MAIN WEBHOOK HANDLER
// ============================================================
module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(200).send('Telegram Bot (24/7) is Active!');
    }

    let update = req.body;
    if (typeof update === 'string') {
        try { update = JSON.parse(update); } catch(e) {}
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

    const user = getUser(chatId);

    try {
        // ================================================
        // AUTHENTICATION CHECK
        // ================================================
        const authenticated = isAuthenticated(user);

        // /start command → always show lock
        if (text === '/start') {
            user.authenticated = false;
            user.state = null;
            await sendLockMessage(chatId, 'new');
            return res.status(200).send('OK');
        }

        // Not authenticated → check if entering code
        if (!authenticated) {
            if (text === SECRET_CODE) {
                user.authenticated = true;
                user.wrongAttempts = 0;
                refreshActivity(user);
                await sendTelegramApi('sendMessage', {
                    chat_id: chatId,
                    text: `✅ <b>Kod to'g'ri! Xush kelibsiz, ${escapeHtml(firstName)}!</b> 🎉\n\n🌟 <b>Vazifalar & Harajatlar Botiga Xush Kelibsiz!</b>\n\n📌 Pastdagi tugmalardan foydalaning:\n💸 <b>Harajat Qo'shish</b> — kunlik xarajatlarni kiriting\n✅ <b>Vazifa Qo'shish</b> — kunlik vazifalarni belgilang\n📊 <b>Kunlik Hisobot</b> — harajatlar hisoboti\n📋 <b>Vazifalar Ro'yxati</b> — barcha vazifalar\n\n⏱ <i>${AUTO_LOCK_MINUTES} daqiqa faoliyatsizlikdan so'ng avtomatik qulflandi.</i>`,
                    parse_mode: 'HTML',
                    reply_markup: MAIN_KEYBOARD
                });
            } else {
                user.wrongAttempts = (user.wrongAttempts || 0) + 1;
                const attemptsLeft = Math.max(0, 5 - user.wrongAttempts);
                if (user.wrongAttempts >= 5) {
                    await sendTelegramApi('sendMessage', {
                        chat_id: chatId,
                        text: `🚫 <b>Juda ko'p noto'g'ri urinish!</b>\n\nBotdan foydalanish vaqtincha bloklandi.\nQaytadan urinish uchun <b>/start</b> yozing.`,
                        parse_mode: 'HTML',
                        reply_markup: { remove_keyboard: true }
                    });
                    user.wrongAttempts = 0;
                } else {
                    await sendTelegramApi('sendMessage', {
                        chat_id: chatId,
                        text: `❌ <b>Kod noto'g'ri!</b>\n\nQaytadan kiriting.\n<i>Qolgan urinishlar: ${attemptsLeft} ta</i>`,
                        parse_mode: 'HTML'
                    });
                }
            }
            return res.status(200).send('OK');
        }

        // ================================================
        // AUTHENTICATED: Refresh activity on every message
        // ================================================
        refreshActivity(user);

        // /help command
        if (text === '/help') {
            await sendTelegramApi('sendMessage', {
                chat_id: chatId,
                text: `📌 <b>Botdan foydalanish yo'riqnomasi:</b>\n\n💸 <b>Harajat Qo'shish</b> — summa kiriting, toifa tanlang\n✅ <b>Vazifa Qo'shish</b> — sarlavha va muhimlik darajasini kiriting\n📊 <b>Kunlik Hisobot</b> — bugungi harajatlar ro'yxati\n📋 <b>Vazifalar Ro'yxati</b> — barcha vazifalar\n🌐 <b>Web Sayt</b> — to'liq interaktiv ilova\n\n⏱ <i>${AUTO_LOCK_MINUTES} daqiqa faoliyatsizlikdan so'ng avtomatik qulflandi.</i>`,
                parse_mode: 'HTML',
                reply_markup: MAIN_KEYBOARD
            });
            return res.status(200).send('OK');
        }

        // WEB SAYT TUGMASI
        if (text === '🌐 Web Saytni Ochish') {
            await sendTelegramApi('sendMessage', {
                chat_id: chatId,
                text: `🌐 <b>Web Ilovani Ochish</b>\n\nTo'liq funksiyalar uchun quyidagi tugmani bosing:`,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🌐 Web Saytni Ochish', web_app: { url: webAppUrl } }]
                    ]
                }
            });
            return res.status(200).send('OK');
        }

        // HARAJAT QO'SHISH BOSHLASH
        if (text === '💸 Harajat Qo\'shish') {
            user.state = 'awaiting_expense_amount';
            await sendTelegramApi('sendMessage', {
                chat_id: chatId,
                text: `💸 <b>Harajat Qo'shish</b>\n\nHarajat summasini kiriting:\n<i>Masalan: 50000 yoki 150 000</i>`,
                parse_mode: 'HTML',
                reply_markup: { remove_keyboard: true }
            });
            return res.status(200).send('OK');
        }

        // KUNLIK HISOBOT
        if (text === '📊 Kunlik Hisobot' || text === '/hisobot') {
            user.state = null;
            await sendDailyExpenseReport(chatId, firstName, user);
            return res.status(200).send('OK');
        }

        // VAZIFA QO'SHISH BOSHLASH
        if (text === '✅ Vazifa Qo\'shish') {
            user.state = 'awaiting_task_title';
            await sendTelegramApi('sendMessage', {
                chat_id: chatId,
                text: `✅ <b>Yangi Vazifa Qo'shish</b>\n\nVazifa sarlavhasini kiriting:\n<i>Masalan: Kitob o'qish yoki Hisobot tayyorlash</i>`,
                parse_mode: 'HTML',
                reply_markup: { remove_keyboard: true }
            });
            return res.status(200).send('OK');
        }

        // VAZIFALAR RO'YXATI
        if (text === '📋 Vazifalar Ro\'yxati' || text === '/vazifalar') {
            user.state = null;
            await sendTaskList(chatId, firstName, user);
            return res.status(200).send('OK');
        }

        // ================================================
        // STATE MACHINE
        // ================================================

        // STATE: awaiting_expense_amount
        if (user.state === 'awaiting_expense_amount') {
            const amount = parseAmount(text);
            if (amount) {
                user.pendingAmount = amount;
                user.state = 'awaiting_expense_desc';
                await sendTelegramApi('sendMessage', {
                    chat_id: chatId,
                    text: `💰 Summa: <b>${formatMoney(amount)}</b>\n\n❓ Bu harajat <b>nima uchun sarflandi?</b>\nQuyidagi toifalardan birini tanlang yoki o'zingiz yozing:`,
                    parse_mode: 'HTML',
                    reply_markup: {
                        keyboard: [
                            ['🍽 Taom/Oziq-ovqat', '🚕 Transport'],
                            ['🛍 Xarid', '💊 Sog\'liq'],
                            ['💡 Kommunal', '🎬 O\'yin-kulgi'],
                            ['📦 Boshqa']
                        ],
                        resize_keyboard: true,
                        one_time_keyboard: true
                    }
                });
            } else {
                await sendTelegramApi('sendMessage', {
                    chat_id: chatId,
                    text: `❗ Iltimos, faqat <b>raqam</b> kiriting.\n<i>Masalan: 50000 yoki 150 000</i>`,
                    parse_mode: 'HTML'
                });
            }
            return res.status(200).send('OK');
        }

        // STATE: awaiting_expense_desc
        if (user.state === 'awaiting_expense_desc') {
            const description = text;
            const amount = user.pendingAmount;
            if (description && amount) {
                user.expenses.push({
                    amount,
                    description,
                    date: getTodayStr(),
                    time: getTimeStr()
                });
                user.pendingAmount = null;
                user.state = null;

                const todayTotal = user.expenses
                    .filter(e => e.date === getTodayStr())
                    .reduce((s, e) => s + e.amount, 0);

                await sendTelegramApi('sendMessage', {
                    chat_id: chatId,
                    text: `✅ <b>Harajat Saqlandi!</b>\n\n💵 <b>Summa:</b> ${formatMoney(amount)}\n📝 <b>Izoh:</b> ${escapeHtml(description)}\n📅 <b>Sana:</b> ${getTodayStr()}\n🕐 <b>Vaqt:</b> ${getTimeStr()}\n\n📊 <b>Bugungi jami harajat:</b> <code>${formatMoney(todayTotal)}</code>`,
                    parse_mode: 'HTML',
                    reply_markup: MAIN_KEYBOARD
                });
            }
            return res.status(200).send('OK');
        }

        // STATE: awaiting_task_title
        if (user.state === 'awaiting_task_title') {
            user.pendingTaskTitle = text;
            user.state = 'awaiting_task_priority';
            await sendTelegramApi('sendMessage', {
                chat_id: chatId,
                text: `📝 <b>Vazifa:</b> ${escapeHtml(text)}\n\n⚡ <b>Muhimlik darajasini tanlang:</b>`,
                parse_mode: 'HTML',
                reply_markup: {
                    keyboard: [
                        ['🔴 Yuqori (Shoshilinch)'],
                        ['🟡 O\'rta (Muhim)'],
                        ['🟢 Past (Odatiy)']
                    ],
                    resize_keyboard: true,
                    one_time_keyboard: true
                }
            });
            return res.status(200).send('OK');
        }

        // STATE: awaiting_task_priority
        if (user.state === 'awaiting_task_priority') {
            let priority = 'medium';
            let priorityEmoji = '🟡';
            let priorityLabel = "O'rta";
            if (text.includes('Yuqori') || text.includes('🔴')) {
                priority = 'high'; priorityEmoji = '🔴'; priorityLabel = 'Yuqori';
            } else if (text.includes('Past') || text.includes('🟢')) {
                priority = 'low'; priorityEmoji = '🟢'; priorityLabel = 'Past';
            }

            const taskTitle = user.pendingTaskTitle;
            user.tasks.push({
                title: taskTitle,
                priority,
                priorityEmoji,
                priorityLabel,
                date: getTodayStr(),
                time: getTimeStr(),
                completed: false
            });
            user.pendingTaskTitle = null;
            user.state = null;

            await sendTelegramApi('sendMessage', {
                chat_id: chatId,
                text: `✅ <b>Vazifa Qo'shildi!</b>\n\n📌 <b>Vazifa:</b> ${escapeHtml(taskTitle)}\n${priorityEmoji} <b>Muhimlik:</b> ${priorityLabel}\n📅 <b>Sana:</b> ${getTodayStr()}\n🕐 <b>Vaqt:</b> ${getTimeStr()}`,
                parse_mode: 'HTML',
                reply_markup: MAIN_KEYBOARD
            });
            return res.status(200).send('OK');
        }

        // ================================================
        // RAQAM kiritilsa (state yo'q bo'lsa)
        // ================================================
        const detectedAmount = parseAmount(text);
        if (detectedAmount) {
            user.pendingAmount = detectedAmount;
            user.state = 'awaiting_expense_desc';
            await sendTelegramApi('sendMessage', {
                chat_id: chatId,
                text: `💰 Summa: <b>${formatMoney(detectedAmount)}</b>\n\n❓ Bu harajat <b>nima uchun sarflandi?</b>\nToifa tanlang yoki o'zingiz yozing:`,
                parse_mode: 'HTML',
                reply_markup: {
                    keyboard: [
                        ['🍽 Taom/Oziq-ovqat', '🚕 Transport'],
                        ['🛍 Xarid', '💊 Sog\'liq'],
                        ['💡 Kommunal', '🎬 O\'yin-kulgi'],
                        ['📦 Boshqa']
                    ],
                    resize_keyboard: true,
                    one_time_keyboard: true
                }
            });
            return res.status(200).send('OK');
        }

        // DEFAULT
        await sendTelegramApi('sendMessage', {
            chat_id: chatId,
            text: `💡 Pastdagi tugmalardan birini tanlang yoki harajat summasini yozing.`,
            parse_mode: 'HTML',
            reply_markup: MAIN_KEYBOARD
        });

    } catch (err) {
        console.error("Bot error:", err);
    }

    return res.status(200).send('OK');
};

// ============================================================
// DAILY EXPENSE REPORT
// ============================================================
async function sendDailyExpenseReport(chatId, firstName, user) {
    const todayStr = getTodayStr();
    const todayExpenses = user.expenses.filter(e => e.date === todayStr);
    const totalSum = todayExpenses.reduce((s, e) => s + e.amount, 0);

    let itemsText = '';
    if (todayExpenses.length === 0) {
        itemsText = '\n<i>Bugun hali harajat kiritilmadi.</i>';
    } else {
        todayExpenses.forEach((e, i) => {
            itemsText += `\n${i+1}. ${escapeHtml(e.description)} — <b>${formatMoney(e.amount)}</b> <i>(${e.time})</i>`;
        });
    }

    await sendTelegramApi('sendMessage', {
        chat_id: chatId,
        text: `📊 <b>KUNLIK HARAJATLAR HISOBOTI</b>\n📅 <b>${todayStr}</b>\n👤 <b>${escapeHtml(firstName)}</b>\n\n💸 <b>Jami Harajat: <code>${formatMoney(totalSum)}</code></b>\n📝 <b>Harajatlar ro'yxati:</b>${itemsText}\n\n✨ <i>Ertangi kuningiz barakali bo'lsin!</i>`,
        parse_mode: 'HTML',
        reply_markup: MAIN_KEYBOARD
    });
}

// ============================================================
// TASK LIST
// ============================================================
async function sendTaskList(chatId, firstName, user) {
    const tasks = user.tasks;

    if (tasks.length === 0) {
        await sendTelegramApi('sendMessage', {
            chat_id: chatId,
            text: `📋 <b>Vazifalar Ro'yxati</b>\n\n<i>Hali hech qanday vazifa qo'shilmagan.</i>\n\nYangi vazifa qo'shish uchun <b>✅ Vazifa Qo'shish</b> tugmasini bosing.`,
            parse_mode: 'HTML',
            reply_markup: MAIN_KEYBOARD
        });
        return;
    }

    const pending = tasks.filter(t => !t.completed);
    const done = tasks.filter(t => t.completed);

    let taskText = '';
    if (pending.length > 0) {
        taskText += '\n⏳ <b>Kutilmoqda:</b>';
        pending.forEach((t, i) => {
            taskText += `\n${i+1}. ${t.priorityEmoji} ${escapeHtml(t.title)} <i>(${t.date})</i>`;
        });
    }
    if (done.length > 0) {
        taskText += '\n\n✅ <b>Bajarildi:</b>';
        done.forEach((t, i) => {
            taskText += `\n${i+1}. ✔️ ${escapeHtml(t.title)}`;
        });
    }

    await sendTelegramApi('sendMessage', {
        chat_id: chatId,
        text: `📋 <b>VAZIFALAR RO'YXATI</b>\n📅 ${getTodayStr()}\n👤 ${escapeHtml(firstName)}\n${taskText}\n\n<i>📌 Jami: ${tasks.length} ta | ✅ ${done.length} ta | ⏳ ${pending.length} ta</i>`,
        parse_mode: 'HTML',
        reply_markup: MAIN_KEYBOARD
    });
}
