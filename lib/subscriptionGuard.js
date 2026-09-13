/**
 * Middleware Guard: Obuna huquqlarini tekshirish
 */
import { CONFIG } from '../config.js';
import { isSubActive } from './subscriptionService.js';

// Obunasiz ishlatish mumkin bo'lgan buyruqlar va tugmalar
const ALLOWED_COMMANDS_UNSUBSCRIBED = new Set([
  '/start',
  '/menu',
  '/sub',
  '/obuna',
  '💳 Obuna',
  '💳 Obunani ko\'rish',
  '💳 Obuna Sotib Olish',
  '🔙 Orqaga'
]);

// Callback query prefikslari (obunasiz ham ishlaydi)
const ALLOWED_CALLBACK_PREFIXES = [
  'sub_click',
  'sub_payme',
  'confirm_pay_',
  'approve_pay_',
  'reject_pay_'
];

/**
 * Xabar yoki callback query obunasiz bajarilishi mumkinmi?
 */
export function isCommandAllowedWithoutSub(text = '', callbackData = '') {
  if (text && ALLOWED_COMMANDS_UNSUBSCRIBED.has(text.trim())) {
    return true;
  }
  if (callbackData) {
    for (const prefix of ALLOWED_CALLBACK_PREFIXES) {
      if (callbackData.startsWith(prefix)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Userning buyruqni bajarish huquqini tekshirish (CheckAccess Middleware)
 */
export async function checkAccess(userId, text = '', callbackData = '') {
  const sUserId = String(userId);

  // 1. Admin uchun cheklov yo'q
  if (sUserId === String(CONFIG.ADMIN_CHAT_ID)) {
    return { allowed: true, isOwner: true };
  }

  // 2. Obunasiz ruxsat berilgan menyu/to'lov tugmalari
  if (isCommandAllowedWithoutSub(text, callbackData)) {
    return { allowed: true, isPublicCommand: true };
  }

  // 3. Obunani KV dan tekshirish
  const active = await isSubActive(sUserId);
  if (active) {
    return { allowed: true };
  }

  // 4. Obunasi faol emas
  return {
    allowed: false,
    reason: 'obuna_talab_qilinadi'
  };
}
