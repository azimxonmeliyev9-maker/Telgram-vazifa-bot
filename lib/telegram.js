/**
 * Telegram Bot API Wrapper (Fetch orqali)
 */
import { CONFIG } from '../config.js';

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
 * Sanani tushunarli formatlash
 */
export function formatDate(timestamp) {
  if (!timestamp) return 'Noma\'lum';
  const d = new Date(timestamp);
  return d.toLocaleDateString('uz-UZ', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
