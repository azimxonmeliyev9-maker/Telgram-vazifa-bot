/**
 * Telegram Bot API Wrapper (Fetch orqali) & Timezone (Asia/Tashkent) Helpers
 */
import { CONFIG } from '../config.js';

export const TIMEZONE = 'Asia/Tashkent';

/**
 * Telegram API so'rovi yuborish
 */
export async function sendTelegramApi(method, body) {
  try {
    const url = `https://api.telegram.org/bot${CONFIG.BOT_TOKEN}/${method}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`[Telegram API Error] Method ${method}:`, error);
    return null;
  }
}

/**
 * Matnli xabar yuborish
 */
export async function sendMessage(chatId, text, options = {}) {
  return await sendTelegramApi('sendMessage', {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML',
    ...options
  });
}

/**
 * Xabar matnini tahrirlash
 */
export async function editMessageText(chatId, messageId, text, options = {}) {
  return await sendTelegramApi('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text: text,
    parse_mode: 'HTML',
    ...options
  });
}

/**
 * Callback query ga javob berish
 */
export async function answerCallbackQuery(callbackQueryId, text = '', showAlert = false) {
  return await sendTelegramApi('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text: text,
    show_alert: showAlert
  });
}

/**
 * Xabarni o'chirish
 */
export async function deleteMessage(chatId, messageId) {
  return await sendTelegramApi('deleteMessage', {
    chat_id: chatId,
    message_id: messageId
  });
}

/**
 * HTML belgilarni xavfsiz qilish
 */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Pul miqdorini formatlash (masalan: 5 000 UZS)
 */
export function formatMoney(amount) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(amount)) + ' UZS';
}

/**
 * Toshkent vaqti bo'yicha YYYY-MM-DD sanasini olish
 */
export function getTashkentToday(dateInput = new Date()) {
  const d = new Date(dateInput);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

/**
 * Toshkent vaqti bo'yicha matnli sana (masalan: 13-sentyabr, 2026-yil)
 */
export function getTashkentDateStr(dateInput = new Date()) {
  const d = new Date(dateInput);
  return d.toLocaleDateString('uz-UZ', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Toshkent vaqti bo'yicha soat:daqiqa (masalan: 14:10)
 */
export function getTashkentTimeStr(dateInput = new Date()) {
  const d = new Date(dateInput);
  return d.toLocaleTimeString('uz-UZ', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

/**
 * Sanani tushunarli formatlash (Toshkent vaqti)
 */
export function formatDate(timestamp) {
  if (!timestamp) return 'Noma\'lum';
  const d = new Date(timestamp);
  return d.toLocaleDateString('uz-UZ', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

/**
 * Toshkent vaqti bo'yicha joriy soat va daqiqani daqiqalarda olish (0 - 1439 min)
 */
export function getTashkentNowMinutes() {
  const timeStr = new Date().toLocaleTimeString('en-US', {
    timeZone: TIMEZONE,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  });
  const [hStr, mStr] = timeStr.split(':');
  return parseInt(hStr, 10) * 60 + parseInt(mStr, 10);
}

/**
 * Toshkent vaqti bo'yicha YYYY-MM kalitini olish (masalan: 2026-09)
 */
export function getTashkentMonthKey(dateInput = new Date()) {
  const d = new Date(dateInput);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit'
  }).format(d);
}

/**
 * Toshkent vaqti bo'yicha YYYY yillik kalitni olish (masalan: 2026)
 */
export function getTashkentYearKey(dateInput = new Date()) {
  const d = new Date(dateInput);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric'
  }).format(d);
}
