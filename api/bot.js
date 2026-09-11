/**
 * VERCEL SERVERLESS FUNCTION - TELEGRAM BOT (24/7) v3.0
 * ✅ Yangiliklar:
 * 1. Kod faqat ertalab bir marta so'raladi (kunlik sessiya)
 * 2. Yangi kod: 0000
 * 3. Ovozli xabar → summa → toifa (to'liq flow)
 * 4. Vazifalar inline "Bajarildi" tugmasi bilan
 * 5. /stat - Statistika bo'limi
 * 6. Callback query handler
 * 7. Harajat izohida parol saqlanib qolish muammosi hal qilindi
 */

const https = require('https');

const BOT_TOKEN = '8699086796:AAEeqqySXI7fXkQmomMEskOWj_zeH9cnMDY';
const SECRET_CODE = '0000';   // ← Yangi kod

// ============================================================
// IN-MEMORY STORE
// ============================================================
const userStore = {};

function getUser(chatId) {
    if (!userStore[chatId]) {
        userStore[chatId] = {
            authenticated: false,
            authDate: null,       // Bugungi sana (YYYY-MM-DD)
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

function getTodayDate() {
    return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

// Faqat yangi kun boshida qayta so'raladi
function isAuthenticated(user) {
    if (!user.authenticated) return false;
    const today = getTodayDate();
    if (user.authDate !== today) {
        user.authenticated = false;
        user.state = null;
        return false;
    }
    return true;
}

// ============================================================
// TELEGRAM API
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
    const clean = text.replace(/\s+/g,'').replace(/,/g,'')
        .replace(/uzs/gi,'').replace(/so'm/gi,'').replace(/som/gi,'');
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
    return new Date().toLocaleDateString('uz-UZ', { year:'numeric', month:'long', day:'numeric' });
}

function getTimeStr() {
    return new Date().toLocaleTimeString('uz-UZ', { hour:'2-digit', minute:'2-digit' });
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
        [{ text: '💸 Harajat Qo\'shish' }, { text: '✅ Vazifa Qo\'shish' }],
        [{ text: '📊 Kunlik Hisobot' },   { text: '📋 Vazifalar Ro\'yxati' }],
        [{ text: '📈 Statistika' },        { text: '🌐 Web Sayt' }]
    ],
    resize_keyboard: true,
    persistent: true
};

const CATEGORY_KEYBOARD = {
    keyboard: [
        ['🍽 Taom/Oziq-ovqat', '🚕 Transport'],
        ['🛍 Xarid', '💊 Sog\'liq'],
        ['💡 Kommunal', '🎬 O\'yin-kulgi'],
        ['📦 Boshqa']
    ],
    resize_keyboard: true,
    one_time_keyboard: true
};

const PRIORITY_KEYBOARD = {
    keyboard: [
        ['🔴 Yuqori (Shoshilinch)'],
        ['🟡 O\'rta (Muhim)'],
        ['🟢 Past (Odatiy)']
    ],
    resize_keyboard: true,
    one_time_keyboard: true
};

// ============================================================
// SEND AUTH PROMPT
// ============================================================
async function sendAuthPrompt(chatId, isNewDay = false) {
    const text = isNewDay
        ? `🌅 <b>Yangi kun boshlandi!</b>\n\nHar kuni bir marta tasdiqlash kerak.\n🔐 Bugungi kodni kiriting:`
        : `🔐 <b>Salom!</b>\n\nBu bot shaxsiy himoyalangan.\nFoydalanish uchun <b>kodni</b> kiriting:`;
    await sendTelegramApi('sendMessage', {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: { remove_keyboard: true }
    });
}

// ============================================================
// MAIN WEBHOOK HANDLER
// ============================================================
module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(200).send('Telegram Bot v3.0 (24/7) Active!');
    }

    let update = req.body;
    if (typeof update === 'string') {
        try { update = JSON.parse(update); } catch(e) {}
    }

    // ── Callback Query Handler (inline tugmalar) ──────────────
    if (update && update.callback_query) {
        await handleCallbackQuery(update.callback_query);
        return res.status(200).send('OK');
    }

    if (!update || !update.message) return res.status(200).send('OK');

    const msg = update.message;
    const chatId = msg.chat.id;
    const firstName = msg.from ? msg.from.first_name : 'Foydalanuvchi';
    const host = req.headers.host || 'telgram-vazifa-bot.vercel.app';
    const webAppUrl = `https://${host}`;
    const user = getUser(chatId);

    try {
        // ── VOICE / AUDIO MESSAGE ─────────────────────────────
        if (msg.voice || msg.audio) {
            if (!isAuthenticated(user)) {
                await sendAuthPrompt(chatId);
                return res.status(200).send('OK');
            }
            const duration = msg.voice ? msg.voice.duration : 0;
            user.state = 'awaiting_expense_amount_after_voice';
            await sendTelegramApi('sendMessage', {
                chat_id: chatId,
                text: `🎤 <b>Ovozli xabar qabul qilindi!</b> (${duration} sek)\n\n💰 Harajat summasini yozing:\n<i>Masalan: 50000</i>`,
                parse_mode: 'HTML',
                reply_markup: { remove_keyboard: true }
            });
            return res.status(200).send('OK');
        }

        const text = (msg.text || '').trim();

        // ── /start ────────────────────────────────────────────
        if (text === '/start') {
            const today = getTodayDate();
            if (user.authenticated && user.authDate === today) {
                // Bugun allaqachon kirgan — to'g'ridan menuга
                await sendTelegramApi('sendMessage', {
                    chat_id: chatId,
                    text: `👋 <b>Xush kelibsiz, ${escapeHtml(firstName)}!</b>\n\n📌 Pastdagi tugmalardan foydalaning:`,
                    parse_mode: 'HTML',
                    reply_markup: MAIN_KEYBOARD
                });
            } else {
                const isNewDay = user.authenticated && user.authDate && user.authDate !== today;
                user.authenticated = false;
                user.state = null;
                await sendAuthPrompt(chatId, isNewDay);
            }
            return res.status(200).send('OK');
        }

        // ── AUTH CHECK ────────────────────────────────────────
        if (!isAuthenticated(user)) {
            if (text === SECRET_CODE) {
                user.authenticated = true;
                user.authDate = getTodayDate();
                user.wrongAttempts = 0;
                await sendTelegramApi('sendMessage', {
                    chat_id: chatId,
                    text: `✅ <b>Xush kelibsiz, ${escapeHtml(firstName)}!</b> 🎉\n\n🌟 <b>Vazifalar & Harajatlar Boti</b>\n\n📌 Bugun siz uchun:\n💸 Harajat qo'shing\n✅ Vazifa belgilang\n📊 Hisobot ko'ring\n\n<i>Bugun shu kod bilan bir marta kirasiz — qayta so'ralmaydi.</i>`,
                    parse_mode: 'HTML',
                    reply_markup: MAIN_KEYBOARD
                });
            } else if (text.length > 0) {
                user.wrongAttempts = (user.wrongAttempts || 0) + 1;
                if (user.wrongAttempts >= 5) {
                    await sendTelegramApi('sendMessage', {
                        chat_id: chatId,
                        text: `🚫 <b>Juda ko'p noto'g'ri urinish!</b>\n\nQayta urinish uchun /start yozing.`,
                        parse_mode: 'HTML'
                    });
                    user.wrongAttempts = 0;
                } else {
                    await sendTelegramApi('sendMessage', {
                        chat_id: chatId,
                        text: `❌ <b>Kod noto'g'ri!</b>\n<i>Qolgan urinish: ${5 - user.wrongAttempts} ta</i>`,
                        parse_mode: 'HTML'
                    });
                }
            }
            return res.status(200).send('OK');
        }

        // ── MAIN MENU BUTTONS ─────────────────────────────────

        if (text === '💸 Harajat Qo\'shish') {
            user.state = 'awaiting_expense_amount';
            await sendTelegramApi('sendMessage', {
                chat_id: chatId,
                text: `💸 <b>Harajat Qo'shish</b>\n\nSummasini kiriting:\n<i>Masalan: 50000</i>`,
                parse_mode: 'HTML',
                reply_markup: { remove_keyboard: true }
            });
            return res.status(200).send('OK');
        }

        if (text === '📊 Kunlik Hisobot' || text === '/hisobot') {
            user.state = null;
            await sendDailyReport(chatId, firstName, user);
            return res.status(200).send('OK');
        }

        if (text === '✅ Vazifa Qo\'shish') {
            user.state = 'awaiting_task_title';
            await sendTelegramApi('sendMessage', {
                chat_id: chatId,
                text: `✅ <b>Yangi Vazifa</b>\n\nSarlavhasini kiriting:\n<i>Masalan: Kitob o'qish</i>`,
                parse_mode: 'HTML',
                reply_markup: { remove_keyboard: true }
            });
            return res.status(200).send('OK');
        }

        if (text === '📋 Vazifalar Ro\'yxati' || text === '/vazifalar') {
            user.state = null;
            await sendTaskList(chatId, firstName, user);
            return res.status(200).send('OK');
        }

        if (text === '📈 Statistika' || text === '/stat') {
            user.state = null;
            await sendStatistics(chatId, firstName, user);
            return res.status(200).send('OK');
        }

        if (text === '🌐 Web Sayt') {
            await sendTelegramApi('sendMessage', {
                chat_id: chatId,
                text: `🌐 <b>Web Ilovani Ochish</b>`,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🌐 Web Saytni Ochish', web_app: { url: webAppUrl } }
                    ]]
                }
            });
            return res.status(200).send('OK');
        }

        // ── STATE MACHINE ─────────────────────────────────────

        // Summa kiritish (harajat yoki ovozdan keyin)
        if (user.state === 'awaiting_expense_amount' ||
            user.state === 'awaiting_expense_amount_after_voice') {
            const amount = parseAmount(text);
            if (amount) {
                user.pendingAmount = amount;
                user.state = 'awaiting_expense_desc';
                await sendTelegramApi('sendMessage', {
                    chat_id: chatId,
                    text: `💰 Summa: <b>${formatMoney(amount)}</b>\n\n❓ <b>Nima uchun sarflandi?</b>\nToifa tanlang yoki o'zingiz yozing:`,
                    parse_mode: 'HTML',
                    reply_markup: CATEGORY_KEYBOARD
                });
            } else {
                await sendTelegramApi('sendMessage', {
                    chat_id: chatId,
                    text: `❗ Faqat <b>raqam</b> kiriting.\n<i>Masalan: 50000</i>`,
                    parse_mode: 'HTML'
                });
            }
            return res.status(200).send('OK');
        }

        // Izoh / toifa kiritish
        if (user.state === 'awaiting_expense_desc') {
            const amount = user.pendingAmount;
            if (amount && text) {
                user.expenses.push({
                    id: Date.now().toString(),
                    amount,
                    description: text,
                    date: getTodayStr(),
                    dateKey: getTodayDate(),
                    time: getTimeStr()
                });
                user.pendingAmount = null;
                user.state = null;

                const todayTotal = user.expenses
                    .filter(e => e.dateKey === getTodayDate())
                    .reduce((s, e) => s + e.amount, 0);

                await sendTelegramApi('sendMessage', {
                    chat_id: chatId,
                    text: `✅ <b>Harajat Saqlandi!</b>\n\n💵 <b>Summa:</b> ${formatMoney(amount)}\n📝 <b>Izoh:</b> ${escapeHtml(text)}\n🕐 <b>Vaqt:</b> ${getTimeStr()}\n\n📊 <b>Bugungi jami:</b> <code>${formatMoney(todayTotal)}</code>`,
                    parse_mode: 'HTML',
                    reply_markup: MAIN_KEYBOARD
                });
            }
            return res.status(200).send('OK');
        }

        // Vazifa sarlavhasi
        if (user.state === 'awaiting_task_title') {
            user.pendingTaskTitle = text;
            user.state = 'awaiting_task_priority';
            await sendTelegramApi('sendMessage', {
                chat_id: chatId,
                text: `📝 <b>Vazifa:</b> ${escapeHtml(text)}\n\n⚡ <b>Muhimlik darajasi:</b>`,
                parse_mode: 'HTML',
                reply_markup: PRIORITY_KEYBOARD
            });
            return res.status(200).send('OK');
        }

        // Vazifa muhimligi
        if (user.state === 'awaiting_task_priority') {
            let priority = 'medium', emoji = '🟡', label = "O'rta";
            if (text.includes('Yuqori') || text.includes('🔴')) { priority='high'; emoji='🔴'; label='Yuqori'; }
            else if (text.includes('Past') || text.includes('🟢')) { priority='low'; emoji='🟢'; label='Past'; }

            const taskId = Date.now().toString();
            const taskTitle = user.pendingTaskTitle;
            user.tasks.push({
                id: taskId,
                title: taskTitle,
                priority, emoji, label,
                date: getTodayStr(),
                dateKey: getTodayDate(),
                time: getTimeStr(),
                completed: false
            });
            user.pendingTaskTitle = null;
            user.state = null;

            await sendTelegramApi('sendMessage', {
                chat_id: chatId,
                text: `✅ <b>Vazifa Qo'shildi!</b>\n\n📌 ${escapeHtml(taskTitle)}\n${emoji} <b>${label}</b> muhimlik\n🕐 ${getTimeStr()}`,
                parse_mode: 'HTML',
                reply_markup: MAIN_KEYBOARD
            });
            return res.status(200).send('OK');
        }

        // Raqam yuborsа (state yo'q)
        const detected = parseAmount(text);
        if (detected) {
            user.pendingAmount = detected;
            user.state = 'awaiting_expense_desc';
            await sendTelegramApi('sendMessage', {
                chat_id: chatId,
                text: `💰 Summa: <b>${formatMoney(detected)}</b>\n\n❓ <b>Nima uchun sarflandi?</b>`,
                parse_mode: 'HTML',
                reply_markup: CATEGORY_KEYBOARD
            });
            return res.status(200).send('OK');
        }

        // Default
        await sendTelegramApi('sendMessage', {
            chat_id: chatId,
            text: `💡 Pastdagi tugmalardan foydalaning yoki harajat summasini yozing.`,
            parse_mode: 'HTML',
            reply_markup: MAIN_KEYBOARD
        });

    } catch (err) {
        console.error('Bot error:', err);
    }

    return res.status(200).send('OK');
};

// ============================================================
// CALLBACK QUERY — Inline tugmalar (Bajarildi / O'chirish)
// ============================================================
async function handleCallbackQuery(cq) {
    const chatId = cq.message.chat.id;
    const data = cq.data || '';
    const user = getUser(chatId);

    if (data.startsWith('done_task_')) {
        const taskId = data.replace('done_task_', '');
        const task = user.tasks.find(t => t.id === taskId);
        if (task) {
            task.completed = !task.completed;
            const status = task.completed ? '✅ Bajarildi' : '⏳ Qayta ochildi';
            await sendTelegramApi('answerCallbackQuery', {
                callback_query_id: cq.id,
                text: status,
                show_alert: false
            });
            await sendTelegramApi('editMessageText', {
                chat_id: chatId,
                message_id: cq.message.message_id,
                text: `${task.completed ? '✅' : '⏳'} <b>${escapeHtml(task.title)}</b>\n${task.emoji} ${task.label} | 🕐 ${task.time}`,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [[
                        { text: task.completed ? '↩️ Qayta Ochish' : '✅ Bajarildi', callback_data: `done_task_${taskId}` }
                    ]]
                }
            });
        }
    }

    if (data.startsWith('del_exp_')) {
        const expId = data.replace('del_exp_', '');
        user.expenses = user.expenses.filter(e => e.id !== expId);
        await sendTelegramApi('answerCallbackQuery', {
            callback_query_id: cq.id,
            text: "🗑 Harajat o'chirildi",
            show_alert: false
        });
        await sendTelegramApi('deleteMessage', {
            chat_id: chatId,
            message_id: cq.message.message_id
        });
    }
}

// ============================================================
// DAILY REPORT
// ============================================================
async function sendDailyReport(chatId, firstName, user) {
    const today = getTodayDate();
    const todayExp = user.expenses.filter(e => e.dateKey === today);
    const totalSum = todayExp.reduce((s, e) => s + e.amount, 0);

    let items = '';
    if (todayExp.length === 0) {
        items = '\n<i>Bugun harajat kiritilmadi.</i>';
    } else {
        todayExp.forEach((e, i) => {
            items += `\n${i+1}. ${escapeHtml(e.description)} — <b>${formatMoney(e.amount)}</b> <i>(${e.time})</i>`;
        });
    }

    await sendTelegramApi('sendMessage', {
        chat_id: chatId,
        text: `📊 <b>KUNLIK HISOBOT</b>\n📅 <b>${getTodayStr()}</b>\n👤 <b>${escapeHtml(firstName)}</b>\n\n💸 <b>Jami: <code>${formatMoney(totalSum)}</code></b>\n\n📝 <b>Harajatlar:</b>${items}\n\n✨ <i>Ertangi kuningiz barakali bo'lsin!</i>`,
        parse_mode: 'HTML',
        reply_markup: MAIN_KEYBOARD
    });
}

// ============================================================
// TASK LIST (inline Bajarildi tugmasi bilan)
// ============================================================
async function sendTaskList(chatId, firstName, user) {
    const tasks = user.tasks;
    if (tasks.length === 0) {
        await sendTelegramApi('sendMessage', {
            chat_id: chatId,
            text: `📋 <b>Vazifalar bo'sh.</b>\n\nYangi vazifa qo'shish uchun <b>✅ Vazifa Qo'shish</b> tugmasini bosing.`,
            parse_mode: 'HTML',
            reply_markup: MAIN_KEYBOARD
        });
        return;
    }

    const pending = tasks.filter(t => !t.completed);
    const done = tasks.filter(t => t.completed);

    let txt = `📋 <b>VAZIFALAR RO'YXATI</b>\n📅 ${getTodayStr()}\n\n`;
    if (pending.length) {
        txt += '⏳ <b>Kutilmoqda:</b>\n';
        for (const t of pending) {
            txt += `• ${t.emoji} ${escapeHtml(t.title)}\n`;
        }
    }
    if (done.length) {
        txt += '\n✅ <b>Bajarildi:</b>\n';
        for (const t of done) {
            txt += `• ✔️ <s>${escapeHtml(t.title)}</s>\n`;
        }
    }
    txt += `\n<i>Jami: ${tasks.length} | ✅ ${done.length} | ⏳ ${pending.length}</i>`;

    // Har bir pending vazifaga inline tugma
    const inlineButtons = pending.slice(0, 8).map(t => ([
        { text: `✅ ${t.title.substring(0, 25)}`, callback_data: `done_task_${t.id}` }
    ]));

    await sendTelegramApi('sendMessage', {
        chat_id: chatId,
        text: txt,
        parse_mode: 'HTML',
        reply_markup: inlineButtons.length > 0
            ? { inline_keyboard: inlineButtons }
            : { remove_keyboard: true }
    });
}

// ============================================================
// STATISTICS
// ============================================================
async function sendStatistics(chatId, firstName, user) {
    const expenses = user.expenses;
    if (expenses.length === 0) {
        await sendTelegramApi('sendMessage', {
            chat_id: chatId,
            text: `📈 <b>Statistika</b>\n\n<i>Hali harajat kiritilmagan.</i>`,
            parse_mode: 'HTML',
            reply_markup: MAIN_KEYBOARD
        });
        return;
    }

    const today = getTodayDate();
    const todayTotal = expenses.filter(e => e.dateKey === today).reduce((s,e)=>s+e.amount,0);
    const allTotal = expenses.reduce((s,e)=>s+e.amount,0);
    const totalCount = expenses.length;

    // Toifa bo'yicha statistika
    const catMap = {};
    expenses.forEach(e => {
        catMap[e.description] = (catMap[e.description] || 0) + e.amount;
    });
    const topCats = Object.entries(catMap).sort((a,b)=>b[1]-a[1]).slice(0,3);
    let catText = '';
    topCats.forEach(([desc, sum], i) => {
        catText += `\n${i+1}. ${escapeHtml(desc)} — <b>${formatMoney(sum)}</b>`;
    });

    // O'rtacha kunlik
    const uniqueDays = new Set(expenses.map(e => e.dateKey)).size;
    const avgDaily = uniqueDays > 0 ? Math.round(allTotal / uniqueDays) : 0;

    await sendTelegramApi('sendMessage', {
        chat_id: chatId,
        text: `📈 <b>STATISTIKA</b>\n👤 <b>${escapeHtml(firstName)}</b>\n\n💸 <b>Bugungi harajat:</b> <code>${formatMoney(todayTotal)}</code>\n💰 <b>Jami harajat:</b> <code>${formatMoney(allTotal)}</code>\n📊 <b>Jami bitim:</b> ${totalCount} ta\n📅 <b>O'rtacha kunlik:</b> <code>${formatMoney(avgDaily)}</code>\n\n🏆 <b>Eng ko'p sarflangan:</b>${catText}`,
        parse_mode: 'HTML',
        reply_markup: MAIN_KEYBOARD
    });
}
