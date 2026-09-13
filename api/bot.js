/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║   XARAJAT & VAZIFA BOT  —  v6.0 Professional            ║
 * ║   Azimjon uchun shaxsiy moliyaviy boshqaruv boti         ║
 * ╠══════════════════════════════════════════════════════════╣
 * ║  v6.0 Yangiliklar:                                       ║
 * ║  • Admin (egasi) uchun KOD SO'RALMAYDI                   ║
 * ║  • Birinchi foydalanishda chatId avtomatik saqlanadi     ║
 * ║  • Harajatlar tarixi — har harajatda O'chirish/Tahrirlash║
 * ║  • Barcha state muammolari hal qilindi                   ║
 * ║  • KV (Vercel) + global fallback                        ║
 * ╚══════════════════════════════════════════════════════════╝
 */
'use strict';
const https = require('https');

// ─── CONFIG ──────────────────────────────────────────────────
const BOT_TOKEN   = '8699086796:AAEeqqySXI7fXkQmomMEskOWj_zeH9cnMDY';
const SECRET_CODE = '0000';

// Admin chatId — birinchi marta muvaffaqiyatli kirish orqali avtomatik saqlanadi
// Keyin bu foydalanuvchidan KOD SO'RALMAYDI
let OWNER_CHAT_ID = null;   // runtime da to'ldiriladi

// ─── STORAGE ─────────────────────────────────────────────────
let _kv = null;
try { _kv = require('@vercel/kv').kv; } catch (_) {}
if (!global.__store) global.__store = {};

async function dbGet(key) {
    if (_kv) { try { const v = await _kv.get(key); if (v !== null) return v; } catch (_) {} }
    return global.__store[key] ?? null;
}
async function dbSet(key, val) {
    if (_kv) { try { await _kv.set(key, val); } catch (_) {} }
    global.__store[key] = val;  // har doim global ga ham saqlash (fast read)
}

// Owner chatId ni yuklash
async function loadOwner() {
    const id = await dbGet('owner_chat_id');
    if (id) OWNER_CHAT_ID = id;
}
async function saveOwner(chatId) {
    OWNER_CHAT_ID = chatId;
    await dbSet('owner_chat_id', chatId);
}

// ─── USER MODEL ───────────────────────────────────────────────
const DEFAULT_USER = () => ({
    isOwner      : false,
    authDate     : null,
    authExpiry   : null,   // ISO string — auth tugash sanasi
    wrongAttempts: 0,
    state        : null,
    pending      : {},
    expenses     : [],
    incomes      : [],
    tasks        : []
});

async function getUser(chatId) {
    const raw = await dbGet(`u:${chatId}`);
    if (!raw) return DEFAULT_USER();
    const d = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Object.assign(DEFAULT_USER(), d);
}
async function putUser(chatId, u) {
    await dbSet(`u:${chatId}`, u);
}

// ─── AUTH ────────────────────────────────────────────────────
function today() { return new Date().toISOString().slice(0, 10); }

function isAuth(u, chatId) {
    // Owner — KOD SO'RALMAYDI
    if (u.isOwner || (OWNER_CHAT_ID && String(chatId) === String(OWNER_CHAT_ID))) return true;
    // authExpiry (30 kunlik sessiya)
    if (u.authExpiry && new Date() < new Date(u.authExpiry)) return true;
    // Eski authDate fallback
    if (u.authDate === today()) return true;
    return false;
}

function getAuthExpiry(days = 30) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString();
}

// ─── HELPERS ─────────────────────────────────────────────────
function money(n) { return new Intl.NumberFormat('uz-UZ').format(Math.round(n)) + ' UZS'; }
function dateStr() {
    return new Date().toLocaleDateString('uz-UZ', { year:'numeric', month:'long', day:'numeric' });
}
function timeStr() {
    return new Date().toLocaleTimeString('uz-UZ', { hour:'2-digit', minute:'2-digit' });
}
function esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function parseNum(s) {
    if (!s) return null;
    // "27 000", "27,000", "27000", "27k" kabi formatlarni qabul qilish
    let str = String(s).replace(/\s/g,'').replace(/,/g,'').replace(/_/g,'');
    if (/^(\d+)k$/i.test(str)) str = str.replace(/k$/i,'000');
    const n = parseFloat(str);
    return isFinite(n) && n > 0 ? n : null;
}
function isNumericText(s) { return /^\d[\d\s,._k]*$/i.test(s.trim()); }
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2,5); }

// ─── TELEGRAM API ────────────────────────────────────────────
function tgReq(method, body) {
    return new Promise((resolve) => {
        const payload = JSON.stringify(body);
        const req = https.request({
            hostname: 'api.telegram.org',
            path    : `/bot${BOT_TOKEN}/${method}`,
            method  : 'POST',
            headers : { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
        }, res => {
            let d = ''; res.on('data', c => d += c);
            res.on('end', () => { try { resolve(JSON.parse(d)); } catch(_){ resolve(null); } });
        });
        req.on('error', () => resolve(null));
        req.write(payload); req.end();
    });
}
const send = (chatId, text, extra = {}) =>
    tgReq('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...extra });

async function tryDelete(chatId, msgId) {
    try { await tgReq('deleteMessage', { chat_id: chatId, message_id: msgId }); } catch(_){}
}
async function tryEdit(chatId, msgId, text, extra = {}) {
    try { await tgReq('editMessageText', { chat_id: chatId, message_id: msgId, text, parse_mode: 'HTML', ...extra }); } catch(_){}
}

// ─── KEYBOARDS ───────────────────────────────────────────────
const KB_MAIN = {
    keyboard: [
        ['💸 Harajat Qo\'shish', '✅ Vazifa Qo\'shish'],
        ['📊 Kunlik Hisobot',    '📋 Vazifalar Ro\'yxati'],
        ['💰 Balans',            '📈 Statistika'],
        ['🗂 Harajatlar Tarixi']
    ],
    resize_keyboard: true,
    persistent: true
};
const KB_REMOVE = { remove_keyboard: true };

const KB_CATEGORY = {
    keyboard: [
        ['🍽 Taom/Oziq-ovqat', '🚕 Transport'],
        ['🛍 Xarid',            '💊 Sog\'liq'],
        ['💡 Kommunal',         '🎬 O\'yin-kulgi'],
        ['📦 Boshqa']
    ],
    resize_keyboard: true, one_time_keyboard: true
};
const KB_PRIORITY = {
    keyboard: [
        ['🔴 Juda Zarur'],
        ['🟡 Muhim'],
        ['🟢 Oddiy']
    ],
    resize_keyboard: true, one_time_keyboard: true
};
const KB_TIME = {
    keyboard: [
        ['⏰ 09:00', '⏰ 12:00', '⏰ 15:00'],
        ['⏰ 18:00', '⏰ 20:00', '⏰ 22:00'],
        ['📅 Vaqtsiz (eslatma yo\'q)']
    ],
    resize_keyboard: true, one_time_keyboard: true
};
const KB_INCOME_CAT = {
    keyboard: [
        ['💼 Oylik maosh', '🎁 Bonus'],
        ['🛒 Savdo daromadi', '📦 Boshqa kirim']
    ],
    resize_keyboard: true, one_time_keyboard: true
};

// Barcha tugma textlari — auth gate dan o'tkazish uchun
const MENU_TEXTS = new Set([
    '💸 Harajat Qo\'shish','✅ Vazifa Qo\'shish',
    '📊 Kunlik Hisobot','📋 Vazifalar Ro\'yxati',
    '💰 Balans','📈 Statistika','🗂 Harajatlar Tarixi',
    '🍽 Taom/Oziq-ovqat','🚕 Transport','🛍 Xarid',
    '💊 Sog\'liq','💡 Kommunal','🎬 O\'yin-kulgi','📦 Boshqa',
    '🔴 Juda Zarur','🟡 Muhim','🟢 Oddiy',
    '⏰ 09:00','⏰ 12:00','⏰ 15:00',
    '⏰ 18:00','⏰ 20:00','⏰ 22:00',
    '📅 Vaqtsiz (eslatma yo\'q)',
    '💼 Oylik maosh','🎁 Bonus','🛒 Savdo daromadi','📦 Boshqa kirim',
    '💵 Kirim Qo\'shish','🔙 Orqaga'
]);

// ─── AUTH PROMPT ─────────────────────────────────────────────
async function askCode(chatId) {
    await send(chatId,
        `🔐 <b>Tasdiqlash kerak</b>\n\nKodingizni kiriting:`,
        { reply_markup: KB_REMOVE }
    );
}

// ─── BALANCE ─────────────────────────────────────────────────
async function showBalance(chatId, name, u) {
    const inc = (u.incomes||[]).reduce((s,i)=>s+i.amount,0);
    const exp = (u.expenses||[]).reduce((s,e)=>s+e.amount,0);
    const rem = inc - exp;

    if (inc === 0) {
        await send(chatId,
            `💰 <b>Balansingiz</b>\n\n<i>Hali kirim qo'shilmagan.</i>\n\nDaromadingizni qo'shing:`,
            { reply_markup: { keyboard:[['💵 Kirim Qo\'shish']], resize_keyboard:true } }
        );
        return;
    }

    const now  = new Date();
    const mk   = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const mExp = (u.expenses||[]).filter(e=>(e.dateKey||'').startsWith(mk)).reduce((s,e)=>s+e.amount,0);
    const mInc = (u.incomes||[]).filter(i=>(i.dateKey||'').startsWith(mk)).reduce((s,i)=>s+i.amount,0);
    const mPct = mInc>0 ? Math.round(mExp/mInc*100) : (inc>0 ? Math.round(mExp/inc*100) : 0);

    const remLine = rem >= 0
        ? `✅ <b>Qolgan:</b> <code>${money(rem)}</code>`
        : `⚠️ <b>Qolgan:</b> <code>-${money(Math.abs(rem))}</code> <i>(limit oshdi!)</i>`;

    const last = (u.incomes||[]).slice(-3).reverse()
        .map(i=>`• <i>${esc(i.description)}</i> — <b>${money(i.amount)}</b>`).join('\n') || '<i>Yo\'q</i>';

    await send(chatId,
        `💰 <b>BALANSINGIZ</b>  —  ${esc(name)}\n\n` +
        `📥 <b>Jami kirim:</b>   <code>${money(inc)}</code>\n` +
        `📤 <b>Jami harajat:</b> <code>${money(exp)}</code>\n` +
        `━━━━━━━━━━━━━━━━\n${remLine}\n\n` +
        `📊 <b>Bu oy sarflandi:</b> ${money(mExp)} (${mPct}%)\n\n` +
        `💵 <b>So\'nggi kirimlar:</b>\n${last}`,
        {
            reply_markup: {
                inline_keyboard: [[
                    { text:'➕ Kirim Qo\'shish', callback_data:'income_start' },
                    { text:'🔄 Yangilash',       callback_data:'balance_refresh' }
                ]]
            }
        }
    );
}

// ─── DAILY REPORT ────────────────────────────────────────────
async function showDailyReport(chatId, name, u) {
    const td   = today();
    const list = (u.expenses||[]).filter(e=>e.dateKey===td);
    const total= list.reduce((s,e)=>s+e.amount,0);
    const inc  = (u.incomes||[]).reduce((s,i)=>s+i.amount,0);
    const allExp=(u.expenses||[]).reduce((s,e)=>s+e.amount,0);
    const rem  = inc - allExp;

    let balLine = '';
    if (inc > 0) {
        balLine = rem >= 0
            ? `\n━━━━━━━━━━━━━━━━\n✅ <b>Qolgan balans:</b> <code>${money(rem)}</code>`
            : `\n━━━━━━━━━━━━━━━━\n⚠️ <b>Balans:</b> <code>-${money(Math.abs(rem))}</code>`;
    }

    if (list.length === 0) {
        await send(chatId,
            `📊 <b>KUNLIK HISOBOT</b>\n📅 ${dateStr()}  •  ${esc(name)}\n\n<i>Bugun harajat yo'q.</i>${balLine}`,
            { reply_markup: KB_MAIN }
        );
        return;
    }

    // Sarlavha
    await send(chatId,
        `📊 <b>KUNLIK HISOBOT</b>\n📅 ${dateStr()}  •  ${esc(name)}\n\n` +
        `💸 <b>Jami:</b> <code>${money(total)}</code>  •  ${list.length} ta harajat${balLine}\n\n` +
        `<i>Quyidagi harajatlarni o'chirish yoki tahrirlash mumkin 👇</i>`,
        { reply_markup: KB_MAIN }
    );

    // Har bir harajat — alohida xabar + tugmalar
    for (const e of list) {
        await send(chatId,
            `${e.time ? `🕐 <b>${e.time}</b>   ` : ''}💵 <b>${money(e.amount)}</b>\n📝 ${esc(e.description)}`,
            {
                reply_markup: { inline_keyboard: [[
                    { text:'🗑 O\'chirish',  callback_data:`del_${e.id}` },
                    { text:'✏️ Tahrirlash', callback_data:`edit_${e.id}` }
                ]]}
            }
        );
    }
}

// ─── EXPENSE HISTORY ─────────────────────────────────────────
async function showExpenseHistory(chatId, name, u) {
    const all = [...(u.expenses||[])].reverse();
    if (all.length === 0) {
        await send(chatId, `🗂 <b>Harajatlar tarixi bo'sh.</b>`, { reply_markup: KB_MAIN });
        return;
    }

    const byDay = {};
    all.forEach(e => {
        const k = e.dateKey || 'nodate';
        if (!byDay[k]) byDay[k] = [];
        byDay[k].push(e);
    });

    const days = Object.keys(byDay).sort().reverse().slice(0, 10);
    const totalAll = all.reduce((s,e)=>s+e.amount,0);

    await send(chatId,
        `🗂 <b>HARAJATLAR TARIXI</b>\n👤 ${esc(name)}\n` +
        `💰 Jami: <code>${money(totalAll)}</code>  •  ${all.length} ta\n\n` +
        `<i>So'nggi 10 kunlik harajatlar (👇 har birini o'chirib yoki tahrirlashingiz mumkin):</i>`
    );

    for (const day of days) {
        const dayList = byDay[day];
        const dayTotal = dayList.reduce((s,e)=>s+e.amount,0);
        const lbl = day === today() ? '📅 Bugun' : `📅 ${day}`;
        await send(chatId, `${lbl}  ━━━  <b>${money(dayTotal)}</b>`);

        for (const e of dayList) {
            await send(chatId,
                `${e.time ? `🕐 ${e.time}  ` : ''}💵 <b>${money(e.amount)}</b>   📝 ${esc(e.description)}`,
                {
                    reply_markup: { inline_keyboard: [[
                        { text:'🗑 O\'chirish',  callback_data:`del_${e.id}` },
                        { text:'✏️ Tahrirlash', callback_data:`edit_${e.id}` }
                    ]]}
                }
            );
        }
    }
}

// ─── TASK LIST ───────────────────────────────────────────────
async function showTasks(chatId, name, u) {
    const tasks = u.tasks || [];
    const pending = tasks.filter(t=>!t.completed);
    const done    = tasks.filter(t=>t.completed);

    if (tasks.length === 0) {
        await send(chatId,
            `📋 <b>Vazifalar bo'sh.</b>\n\nYangi vazifa qo'shish uchun ✅ Vazifa Qo'shish tugmasini bosing.`,
            { reply_markup: KB_MAIN }
        );
        return;
    }

    let txt = `📋 <b>VAZIFALAR</b>  —  ${esc(name)}\n`;
    if (pending.length) {
        txt += `\n⏳ <b>Bajarilmagan (${pending.length}):</b>\n`;
        pending.forEach(t => {
            txt += `• ${t.emoji} <b>${esc(t.title)}</b>${t.deadlineTime ? ` 🕐${t.deadlineTime}` : ''}\n`;
        });
    }
    if (done.length) {
        txt += `\n✅ <b>Bajarildi (${done.length}):</b>\n`;
        done.slice(-5).forEach(t => { txt += `• ✔ <s>${esc(t.title)}</s>\n`; });
    }

    const buttons = pending.slice(0, 8).map(t=>[
        { text:`✅ ${t.title.slice(0,28)}`, callback_data:`task_done_${t.id}` }
    ]);
    await send(chatId, txt, {
        reply_markup: buttons.length ? { inline_keyboard: buttons } : KB_MAIN
    });
}

// ─── STATISTICS ──────────────────────────────────────────────
async function showStats(chatId, name, u, period) {
    const now = new Date();
    let filtered, label;

    if (period === 'today') {
        filtered = (u.expenses||[]).filter(e=>e.dateKey===today());
        label = '🕐 Bugungi';
    } else if (period === 'week') {
        const from = new Date(now); from.setDate(from.getDate()-7);
        filtered = (u.expenses||[]).filter(e=>e.dateKey && new Date(e.dateKey)>=from);
        label = '📅 Haftalik (7 kun)';
    } else if (period === 'month') {
        const mk = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
        filtered = (u.expenses||[]).filter(e=>(e.dateKey||'').startsWith(mk));
        label = `🗓 ${now.toLocaleDateString('uz-UZ',{month:'long',year:'numeric'})}`;
    } else {
        const yr = String(now.getFullYear());
        filtered = (u.expenses||[]).filter(e=>(e.dateKey||'').startsWith(yr));
        label = `📆 Yillik (${yr})`;
    }

    if (!filtered.length) {
        await send(chatId, `📈 <b>${label}</b>\n\n<i>Bu davr uchun harajat topilmadi.</i>`, { reply_markup: KB_MAIN });
        return;
    }

    const total = filtered.reduce((s,e)=>s+e.amount,0);
    const days  = new Set(filtered.map(e=>e.dateKey)).size;
    const avg   = Math.round(total/Math.max(days,1));

    const catMap = {};
    filtered.forEach(e=>{ catMap[e.description]=(catMap[e.description]||0)+e.amount; });
    const top = Object.entries(catMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
    const catTxt = top.map(([d,s],i)=>{
        const pct = Math.round(s/total*100);
        const bar = '█'.repeat(Math.max(1,Math.round(pct/10)))+'░'.repeat(Math.max(0,10-Math.round(pct/10)));
        return `${i+1}. ${esc(d)}\n   ${bar} ${pct}% — <b>${money(s)}</b>`;
    }).join('\n');

    const dayMap = {};
    filtered.forEach(e=>{ dayMap[e.dateKey]=(dayMap[e.dateKey]||0)+e.amount; });
    const topDay = Object.entries(dayMap).sort((a,b)=>b[1]-a[1])[0];

    await send(chatId,
        `📈 <b>STATISTIKA — ${label}</b>\n👤 ${esc(name)}\n\n` +
        `💰 <b>Jami:</b> <code>${money(total)}</code>\n` +
        `📊 <b>Bitimlar:</b> ${filtered.length} ta\n` +
        `📆 <b>Kunlar:</b> ${days}\n` +
        `📉 <b>O\'rtacha/kun:</b> <code>${money(avg)}</code>\n` +
        (topDay ? `🏆 <b>Eng yuqori kun:</b> ${topDay[0]} — <code>${money(topDay[1])}</code>\n` : '') +
        `\n🏅 <b>Toifalar:</b>\n${catTxt}`,
        {
            reply_markup: {
                inline_keyboard: [
                    [{ text:'🕐 Bugungi',callback_data:'stat_today'},{text:'📅 Haftalik',callback_data:'stat_week'}],
                    [{ text:'🗓 Oylik',callback_data:'stat_month'},{text:'📆 Yillik',callback_data:'stat_year'}]
                ]
            }
        }
    );
}

// ─── REMINDER CHECK ──────────────────────────────────────────
async function checkReminders(chatId, u) {
    const now = new Date();
    const nm  = now.getHours()*60 + now.getMinutes();
    const td  = today();
    let changed = false;

    for (const t of (u.tasks||[])) {
        if (t.completed || !t.deadlineMinutes || t.dateKey !== td) continue;
        if (!t.reminderSent && t.reminderMinutes != null && nm >= t.reminderMinutes && nm < t.deadlineMinutes) {
            t.reminderSent = true; changed = true;
            await send(chatId,
                `⏰ <b>ESLATMA!</b>\n📌 <b>${esc(t.title)}</b>\n${t.emoji} ${t.label}\n\n` +
                `⏱ <b>${t.deadlineMinutes-nm} daqiqa</b> qoldi (🕐 <code>${t.deadlineTime}</code>)\nTez bajaring! 💪`,
                { reply_markup: { inline_keyboard:[[{ text:'✅ Bajarildi!',callback_data:`task_done_${t.id}` }]] } }
            );
        }
        if (!t.deadlineSent && nm >= t.deadlineMinutes) {
            t.deadlineSent = true; changed = true;
            await send(chatId,
                `🔔 <b>MUDDAT TUGADI!</b>\n📌 <b>${esc(t.title)}</b>\n${t.emoji} ${t.label}\n\nBajardingizmi?`,
                { reply_markup: { inline_keyboard:[[
                    { text:'✅ Ha, bajardim!',callback_data:`task_done_${t.id}` },
                    { text:'⏳ Hali yo\'q',   callback_data:`task_skip_${t.id}` }
                ]]} }
            );
        }
    }
    return changed;
}

// ════════════════════════════════════════════════════════════
//  MAIN WEBHOOK HANDLER
// ════════════════════════════════════════════════════════════
module.exports = async (req, res) => {
    res.status(200).send('OK');   // Darhol 200 qaytarish
    if (req.method !== 'POST') return;

    // Owner chatId ni yuklash (cold start dan keyin)
    if (!OWNER_CHAT_ID) await loadOwner();

    let upd = req.body;
    if (typeof upd === 'string') { try { upd = JSON.parse(upd); } catch(_){} }
    if (!upd) return;

    if (upd.callback_query) { await handleCallback(upd.callback_query); return; }
    if (!upd.message) return;

    const msg    = upd.message;
    const chatId = String(msg.chat.id);
    const name   = msg.from?.first_name || 'Foydalanuvchi';
    const u      = await getUser(chatId);
    const save   = () => putUser(chatId, u);

    try {
        // ── OVOZLI XABAR ─────────────────────────────────────
        if (msg.voice || msg.audio) {
            if (!isAuth(u, chatId)) { await askCode(chatId); return; }
            u.state = 'exp_amount'; u.pending = { fromVoice: true };
            await save();
            await send(chatId,
                `🎤 <b>Ovozli xabar qabul qilindi!</b> (${msg.voice?.duration||0} sek)\n\n💰 Harajat summasini yozing:`,
                { reply_markup: KB_REMOVE }
            );
            return;
        }

        const text = (msg.text||'').trim();
        if (!text) return;

        // ── /start ───────────────────────────────────────────
        if (text === '/start' || text === '/menu') {
            u.state = null; u.pending = {};
            await save();
            if (isAuth(u, chatId)) {
                await send(chatId,
                    `👋 <b>Xush kelibsiz, ${esc(name)}!</b>\n\n💸 Harajat  •  ✅ Vazifa  •  💰 Balans`,
                    { reply_markup: KB_MAIN }
                );
            } else {
                await send(chatId,
                    `👋 <b>Assalomu alaykum, ${esc(name)}!</b>\n\n🌟 <b>Xarajat & Vazifa Boti</b>\n\n` +
                    `  💸 Harajatlarni kuzating\n  ✅ Vazifalar belgilang\n  💰 Balansni nazorat qiling\n\n` +
                    `🔐 Kodni kiriting:`,
                    { reply_markup: KB_REMOVE }
                );
            }
            return;
        }

        // ── AUTH GATE ────────────────────────────────────────
        if (!isAuth(u, chatId)) {
            if (text === SECRET_CODE) {
                // ✅ To'g'ri kod — owner sifatida saqlash
                u.authDate    = today();
                u.authExpiry  = getAuthExpiry(365); // 1 yil
                u.isOwner     = true;
                u.wrongAttempts = 0;
                await save();
                // Birinchi marta owner ni saqlash
                if (!OWNER_CHAT_ID) await saveOwner(chatId);

                await send(chatId,
                    `✅ <b>Xush kelibsiz, ${esc(name)}!</b> 🎉\n\n` +
                    `🌟 <b>Vazifalar & Harajatlar Boti</b>\n\n` +
                    `  💸 Harajat qo'shing\n  ✅ Vazifa belgilang\n  💰 Balans ko'ring\n\n` +
                    `<i>✅ Endi sizdan kod so'ralmaydi.</i>`,
                    { reply_markup: KB_MAIN }
                );
            } else if (MENU_TEXTS.has(text) || text.startsWith('/') || isNumericText(text)) {
                await askCode(chatId);
            } else {
                u.wrongAttempts = (u.wrongAttempts||0) + 1;
                await save();
                if (u.wrongAttempts >= 5) {
                    u.wrongAttempts = 0; await save();
                    await send(chatId, `🚫 <b>Juda ko\'p noto\'g\'ri urinish.</b>\n\n/start yozing.`);
                } else {
                    await send(chatId, `❌ <b>Kod noto\'g\'ri</b>  (${5-u.wrongAttempts} urinish qoldi)`);
                }
            }
            return;
        }

        // ════ AUTENTIFIKATSIYA MUVAFFAQIYATLI ════════════════

        // Eslatmalarni tekshir (har xabarda)
        const remChanged = await checkReminders(chatId, u);
        if (remChanged) await save();

        // ── ASOSIY MENYU TUGMALARI ────────────────────────────

        if (text === '💸 Harajat Qo\'shish') {
            u.state = 'exp_amount'; u.pending = {};
            await save();
            await send(chatId, `💸 <b>Harajat Qo\'shish</b>\n\nSummasini kiriting:\n<i>Masalan: 50 000</i>`, { reply_markup: KB_REMOVE });
            return;
        }

        if (text === '✅ Vazifa Qo\'shish') {
            u.state = 'task_title'; u.pending = {};
            await save();
            await send(chatId, `✅ <b>Yangi Vazifa</b>\n\nVazifa nomini yozing:`, { reply_markup: KB_REMOVE });
            return;
        }

        if (text === '📊 Kunlik Hisobot' || text === '/hisobot') {
            u.state = null; await save();
            await showDailyReport(chatId, name, u);
            return;
        }

        if (text === '📋 Vazifalar Ro\'yxati' || text === '/vazifalar') {
            u.state = null; await save();
            await showTasks(chatId, name, u);
            return;
        }

        if (text === '💰 Balans' || text === '/balans') {
            u.state = null; await save();
            await showBalance(chatId, name, u);
            return;
        }

        if (text === '📈 Statistika' || text === '/stat') {
            u.state = null; await save();
            await send(chatId, `📈 <b>Statistika</b>\n\nQaysi davr?`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text:'📅 Haftalik',callback_data:'stat_week'},{text:'🗓 Oylik',callback_data:'stat_month'},{text:'📆 Yillik',callback_data:'stat_year'}],
                        [{ text:'🕐 Bugungi',callback_data:'stat_today'}]
                    ]
                }
            });
            return;
        }

        if (text === '🗂 Harajatlar Tarixi' || text === '/tarix') {
            u.state = null; await save();
            await showExpenseHistory(chatId, name, u);
            return;
        }

        if (text === '💵 Kirim Qo\'shish') {
            u.state = 'inc_amount'; u.pending = {};
            await save();
            await send(chatId, `💵 <b>Kirim Qo\'shish</b>\n\nNecha so\'m?\n<i>Masalan: 2 500 000</i>`, { reply_markup: KB_REMOVE });
            return;
        }

        // ── STATE MACHINE ─────────────────────────────────────

        // HARAJAT: summa
        if (u.state === 'exp_amount') {
            const n = parseNum(text);
            if (n) {
                u.pending.amount = n;
                u.state = 'exp_desc';
                await save();
                await send(chatId,
                    `💰 Summa: <b>${money(n)}</b>\n\n❓ <b>Nima uchun sarflandi?</b>\nToifa tanlang yoki yozing:`,
                    { reply_markup: KB_CATEGORY }
                );
            } else {
                await send(chatId, `❗ Faqat <b>raqam</b> kiriting.\n<i>Masalan: 50000</i>`);
            }
            return;
        }

        // HARAJAT: toifa/izoh
        if (u.state === 'exp_desc') {
            const amount = u.pending?.amount;
            if (amount && text) {
                u.expenses.push({ id:genId(), amount, description:text, date:dateStr(), dateKey:today(), time:timeStr() });
                u.pending = {}; u.state = null;
                await save();

                const todayExp = u.expenses.filter(e=>e.dateKey===today()).reduce((s,e)=>s+e.amount,0);
                const totalInc = (u.incomes||[]).reduce((s,i)=>s+i.amount,0);
                const totalExp = u.expenses.reduce((s,e)=>s+e.amount,0);
                const rem = totalInc - totalExp;
                const balLine = totalInc > 0
                    ? (rem >= 0
                        ? `\n━━━━━━━━━━━━━━━━\n✅ <b>Qolgan balans:</b> <code>${money(rem)}</code>`
                        : `\n━━━━━━━━━━━━━━━━\n⚠️ <b>Qolgan:</b> <code>-${money(Math.abs(rem))}</code>`)
                    : '';

                await send(chatId,
                    `✅ <b>Harajat saqlandi!</b>\n\n💵 ${money(amount)}  •  📝 ${esc(text)}  •  🕐 ${timeStr()}\n\n` +
                    `📊 Bugungi jami: <code>${money(todayExp)}</code>${balLine}`,
                    { reply_markup: KB_MAIN }
                );
            } else {
                u.state = null; await save();
                await send(chatId, `❌ Bekor qilindi.`, { reply_markup: KB_MAIN });
            }
            return;
        }

        // KIRIM: summa
        if (u.state === 'inc_amount') {
            const n = parseNum(text);
            if (n) {
                u.pending.amount = n;
                u.state = 'inc_desc';
                await save();
                await send(chatId, `💵 <b>${money(n)}</b>\n\n📝 Izoh kiriting:`, { reply_markup: KB_INCOME_CAT });
            } else {
                await send(chatId, `❗ Faqat <b>raqam</b> kiriting.`);
            }
            return;
        }

        // KIRIM: izoh
        if (u.state === 'inc_desc') {
            const amount = u.pending?.amount;
            if (amount && text) {
                if (!u.incomes) u.incomes = [];
                u.incomes.push({ id:genId(), amount, description:text, date:dateStr(), dateKey:today(), time:timeStr() });
                u.pending = {}; u.state = null;
                await save();

                const totalInc = u.incomes.reduce((s,i)=>s+i.amount,0);
                const totalExp = u.expenses.reduce((s,e)=>s+e.amount,0);
                await send(chatId,
                    `✅ <b>Kirim saqlandi!</b>\n\n💵 ${money(amount)}  •  📝 ${esc(text)}\n\n` +
                    `📥 Jami kirim: <code>${money(totalInc)}</code>\n📤 Jami harajat: <code>${money(totalExp)}</code>\n` +
                    `✅ Qolgan: <code>${money(totalInc-totalExp)}</code>`,
                    { reply_markup: KB_MAIN }
                );
            } else {
                u.state = null; await save();
                await send(chatId, `❌ Bekor qilindi.`, { reply_markup: KB_MAIN });
            }
            return;
        }

        // VAZIFA: sarlavha
        if (u.state === 'task_title') {
            u.pending.title = text;
            u.state = 'task_priority';
            await save();
            await send(chatId, `📝 <b>${esc(text)}</b>\n\n⚡ Muhimlik darajasini tanlang:`, { reply_markup: KB_PRIORITY });
            return;
        }

        // VAZIFA: muhimlik
        if (u.state === 'task_priority') {
            let emoji='🟡', label='Muhim', priority='medium';
            if (text.includes('Juda Zarur')||text.includes('🔴')) { emoji='🔴'; label='Juda Zarur'; priority='high'; }
            else if (text.includes('Oddiy')||text.includes('🟢'))  { emoji='🟢'; label='Oddiy'; priority='low'; }
            u.pending.priority = { emoji, label, priority };
            u.state = 'task_time';
            await save();
            await send(chatId, `${emoji} <b>${label}</b>\n\n🕐 Qaysi soatga bajarilishi kerak?`, { reply_markup: KB_TIME });
            return;
        }

        // VAZIFA: vaqt
        if (u.state === 'task_time') {
            const { title, priority:pr } = u.pending || {};
            const { emoji='🟡', label='Muhim' } = pr || {};
            let deadlineTime=null, deadlineMinutes=null, reminderMinutes=null;

            if (text !== '📅 Vaqtsiz (eslatma yo\'q)') {
                const m = text.replace('⏰','').trim().match(/^(\d{1,2}):(\d{2})$/);
                if (m) {
                    const h=parseInt(m[1]), min=parseInt(m[2]);
                    if (h>=0&&h<=23&&min>=0&&min<=59) {
                        deadlineTime    = `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
                        deadlineMinutes = h*60+min;
                        reminderMinutes = deadlineMinutes-30;
                    }
                }
            }

            const task = {
                id:genId(), title:title||'Vazifa', priority:pr?.priority||'medium', emoji, label,
                date:dateStr(), dateKey:today(), time:timeStr(),
                deadlineTime, deadlineMinutes, reminderMinutes,
                reminderSent:false, deadlineSent:false, completed:false
            };
            u.tasks.push(task);
            u.pending = {}; u.state = null;
            await save();

            let txt = `✅ <b>Vazifa qo\'shildi!</b>\n\n📌 <b>${esc(task.title)}</b>\n${emoji} ${label}`;
            if (deadlineTime) txt += `\n⏰ Eslatma: ${deadlineTime} dan 30 daqiqa oldin`;
            await send(chatId, txt, { reply_markup: KB_MAIN });
            return;
        }

        // Raqam yozilganda — to'g'ridan harajat sifatida qabul qil
        if (isNumericText(text)) {
            const n = parseNum(text);
            if (n) {
                u.pending = { amount: n };
                u.state = 'exp_desc';
                await save();
                await send(chatId,
                    `💰 Summa: <b>${money(n)}</b>\n\n❓ Nima uchun sarflandi?\nToifa tanlang yoki yozing:`,
                    { reply_markup: KB_CATEGORY }
                );
                return;
            }
        }

        // Noma'lum matn
        await send(chatId,
            `💡 Harajat qo\'shish uchun summa yozing yoki tugmalardan foydalaning:`,
            { reply_markup: KB_MAIN }
        );

    } catch (err) {
        console.error('[BOT ERROR]', err?.message || err);
        try { await send(chatId, `⚠️ Xato yuz berdi. /start yozing.`, { reply_markup: KB_MAIN }); } catch(_){}
    }
};

// ════════════════════════════════════════════════════════════
//  CALLBACK QUERY HANDLER
// ════════════════════════════════════════════════════════════
async function handleCallback(cq) {
    const chatId = String(cq.message.chat.id);
    const data   = cq.data || '';
    const name   = cq.from?.first_name || 'Foydalanuvchi';
    const u      = await getUser(chatId);
    const save   = () => putUser(chatId, u);
    const ack    = (text='') => tgReq('answerCallbackQuery', { callback_query_id:cq.id, text, show_alert:false });

    // Statistika
    if (['stat_today','stat_week','stat_month','stat_year'].includes(data)) {
        const map = { stat_today:'today', stat_week:'week', stat_month:'month', stat_year:'year' };
        await ack('Yuklanmoqda...');
        await showStats(chatId, name, u, map[data]);
        return;
    }

    // Vazifa bajarildi
    if (data.startsWith('task_done_')) {
        const id = data.slice(10);
        const t = (u.tasks||[]).find(t=>t.id===id);
        if (t) {
            t.completed = !t.completed;
            await save();
            await ack(t.completed ? '✅ Bajarildi!' : '↩️ Qayta ochildi');
            await tryEdit(chatId, cq.message.message_id,
                `${t.completed?'✅':'⏳'} <b>${esc(t.title)}</b>\n${t.emoji} ${t.label}${t.deadlineTime ? ` | 🕐${t.deadlineTime}` : ''}`,
                { reply_markup: { inline_keyboard:[[{ text:t.completed?'↩️ Qayta Ochish':'✅ Bajarildi', callback_data:`task_done_${id}` }]] } }
            );
        }
        return;
    }

    // Vazifa skip
    if (data.startsWith('task_skip_')) {
        const id = data.slice(10);
        const t = (u.tasks||[]).find(t=>t.id===id);
        await ack('⏳ Keyinroq bajaring!');
        if (t) {
            await tryEdit(chatId, cq.message.message_id,
                `⏳ <b>${esc(t.title)}</b>\n${t.emoji} ${t.label}\n\n<i>Hali bajarilmadi.</i>`,
                { reply_markup: { inline_keyboard:[[{ text:'✅ Bajarildi!',callback_data:`task_done_${id}` }]] } }
            );
        }
        return;
    }

    // Harajat o'chirish
    if (data.startsWith('del_')) {
        const id  = data.slice(4);
        const exp = (u.expenses||[]).find(e=>e.id===id);
        u.expenses = (u.expenses||[]).filter(e=>e.id!==id);
        await save();
        await ack("🗑 O'chirildi!");
        await tryDelete(chatId, cq.message.message_id);
        if (exp) {
            const totalInc = (u.incomes||[]).reduce((s,i)=>s+i.amount,0);
            const totalExp = u.expenses.reduce((s,e)=>s+e.amount,0);
            const rem = totalInc - totalExp;
            const balLine = totalInc > 0
                ? (rem>=0 ? `\n✅ Yangi balans: <code>${money(rem)}</code>` : `\n⚠️ Yangi balans: <code>-${money(Math.abs(rem))}</code>`)
                : '';
            await send(chatId, `🗑 <b>O\'chirildi:</b> ${esc(exp.description)} — <code>${money(exp.amount)}</code>${balLine}`);
        }
        return;
    }

    // Harajat tahrirlash
    if (data.startsWith('edit_')) {
        const id  = data.slice(5);
        const exp = (u.expenses||[]).find(e=>e.id===id);
        if (!exp) { await ack('Topilmadi'); return; }
        u.expenses = (u.expenses||[]).filter(e=>e.id!==id);
        u.state = 'exp_amount'; u.pending = {};
        await save();
        await ack('✏️ Tahrirlash...');
        await tryDelete(chatId, cq.message.message_id);
        await send(chatId,
            `✏️ <b>Tahrirlash</b>\n\n` +
            `🗑 O\'chirildi: <s>${esc(exp.description)}</s> — <code>${money(exp.amount)}</code>\n\n` +
            `Yangi summasini kiriting:`,
            { reply_markup: KB_REMOVE }
        );
        return;
    }

    // Balans
    if (data === 'balance_refresh') {
        await ack('🔄 Yangilanmoqda...');
        await showBalance(chatId, name, u);
        return;
    }
    if (data === 'income_start') {
        await ack();
        u.state = 'inc_amount'; u.pending = {};
        await save();
        await send(chatId, `💵 <b>Kirim Qo\'shish</b>\n\nNecha so\'m?\n<i>Masalan: 2 500 000</i>`, { reply_markup: KB_REMOVE });
        return;
    }

    await ack();
}
