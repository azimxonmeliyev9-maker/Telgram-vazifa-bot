/**
 * Obuna va To'lovlar Xizmati (Vercel KV Store)
 */
import { CONFIG } from '../config.js';
import { dbGet, dbSet } from './storage.js';

/**
 * Noyob tasodifiy to'lov kodi generatsiyasi (masalan: AZ1807490089A7X2)
 */
function generatePaymentCode(userId) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 4; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `AZ${userId}${rand}`;
}

/**
 * Userning obuna ma'lumotlarini olish
 */
export async function getSubscription(userId) {
  const sUserId = String(userId);
  
  // Admin har doim cheksiz active
  if (sUserId === String(CONFIG.ADMIN_CHAT_ID)) {
    return {
      status: 'active',
      expiresAt: Date.now() + (365 * 24 * 60 * 60 * 1000), // 1 yil
      lastPaymentCode: 'ADMIN'
    };
  }

  const defaultSub = {
    status: 'none',
    expiresAt: null,
    lastPaymentCode: null
  };

  const data = await dbGet(`sub:${sUserId}`);
  if (!data) return defaultSub;

  const sub = Object.assign({}, defaultSub, data);

  // Muddat tugaganligini tekshirish
  if (sub.expiresAt && sub.expiresAt < Date.now()) {
    if (sub.status === 'active') {
      sub.status = 'expired';
      await dbSet(`sub:${sUserId}`, sub);
    }
  }

  return sub;
}

/**
 * Obuna faolmi? (Boolean)
 */
export async function isSubActive(userId) {
  const sUserId = String(userId);
  if (sUserId === String(CONFIG.ADMIN_CHAT_ID)) return true;

  const sub = await getSubscription(userId);
  return sub.status === 'active' && sub.expiresAt && sub.expiresAt > Date.now();
}

/**
 * Kutilayotgan yangi to'lov yaratish
 */
export async function createPendingPayment(userId, username, fullName) {
  const sUserId = String(userId);
  const code = generatePaymentCode(sUserId);
  const now = Date.now();

  const payment = {
    code: code,
    userId: sUserId,
    username: username || '',
    fullName: fullName || 'Foydalanuvchi',
    amount: CONFIG.SUBSCRIPTION_PRICE,
    createdAt: now,
    status: 'pending',
    actedAt: null
  };

  // 1. Payment yozuvini saqlash
  await dbSet(`payment:${code}`, payment);

  // 2. User sub holatini 'awaiting_confirmation' ga o'tkazish
  const currentSub = await getSubscription(sUserId);
  await dbSet(`sub:${sUserId}`, {
    ...currentSub,
    status: 'awaiting_confirmation',
    lastPaymentCode: code
  });

  return payment;
}

/**
 * To'lov ma'lumotini kodi bo'yicha olish
 */
export async function getPayment(code) {
  if (!code) return null;
  return await dbGet(`payment:${code.trim().toUpperCase()}`);
}

/**
 * To'lovni tasdiqlash (Admin tomonidan)
 * Safe double-approve prevention: Faqat 'pending' statusidagi to'lov tasdiqlanadi.
 * Obuna vaqti mavjud bo'lsa, yangi 30 kun uning ustiga qo'shiladi (Stacking).
 */
export async function approvePayment(code, adminUserId) {
  const cleanCode = code.trim().toUpperCase();
  const payment = await getPayment(cleanCode);

  if (!payment) {
    throw new Error(`To'lov kodi topilmadi: ${cleanCode}`);
  }

  if (payment.status !== 'pending') {
    throw new Error(`Ushbu to'lov allaqachon ko'rib chiqilgan! Status: ${payment.status}`);
  }

  const sUserId = String(payment.userId);
  const now = Date.now();
  const daysInMs = CONFIG.SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000;

  // Joriy obunani olish
  const currentSub = await getSubscription(sUserId);
  let newExpiresAt;

  // Agar mavjud faol obuna bo'lsa, yangi 30 kun uning ustiga qo'shiladi
  if (currentSub.expiresAt && currentSub.expiresAt > now) {
    newExpiresAt = currentSub.expiresAt + daysInMs;
  } else {
    newExpiresAt = now + daysInMs;
  }

  // 1. Payment holatini yangilash
  const updatedPayment = {
    ...payment,
    status: 'approved',
    actedAt: now,
    actedBy: String(adminUserId)
  };
  await dbSet(`payment:${cleanCode}`, updatedPayment);

  // 2. User obunasini faollashtirish
  const updatedSub = {
    status: 'active',
    expiresAt: newExpiresAt,
    lastPaymentCode: cleanCode
  };
  await dbSet(`sub:${sUserId}`, updatedSub);

  return {
    payment: updatedPayment,
    newExpiresAt: newExpiresAt
  };
}

/**
 * To'lovni rad etish (Admin tomonidan)
 * Safe double-approve prevention: Faqat 'pending' statusidagi to'lov rad etiladi.
 */
export async function rejectPayment(code, adminUserId) {
  const cleanCode = code.trim().toUpperCase();
  const payment = await getPayment(cleanCode);

  if (!payment) {
    throw new Error(`To'lov kodi topilmadi: ${cleanCode}`);
  }

  if (payment.status !== 'pending') {
    throw new Error(`Ushbu to'lov allaqachon ko'rib chiqilgan! Status: ${payment.status}`);
  }

  const sUserId = String(payment.userId);
  const now = Date.now();

  // 1. Payment holatini yangilash
  const updatedPayment = {
    ...payment,
    status: 'rejected',
    actedAt: now,
    actedBy: String(adminUserId)
  };
  await dbSet(`payment:${cleanCode}`, updatedPayment);

  // 2. User obuna statusini qayta tekshirish
  const currentSub = await getSubscription(sUserId);
  const isStillActive = currentSub.expiresAt && currentSub.expiresAt > now;

  await dbSet(`sub:${sUserId}`, {
    ...currentSub,
    status: isStillActive ? 'active' : 'expired'
  });

  return updatedPayment;
}
