/**
 * Centralized Persistent Storage Library (Vercel KV + Fallback)
 */
import { CONFIG } from '../config.js';

let kv = null;
try {
  const kvModule = await import('@vercel/kv');
  kv = kvModule.kv;
} catch (_) {}

if (!global.__persistent_store) {
  global.__persistent_store = {};
}

/**
 * Bazadan kalit bo'yicha ma'lumotni o'qish
 */
export async function dbGet(key) {
  if (kv) {
    try {
      const data = await kv.get(key);
      if (data !== null && data !== undefined) {
        return typeof data === 'string' ? JSON.parse(data) : data;
      }
    } catch (err) {
      console.warn(`[KV Get Error] Key ${key}: ${err.message}`);
    }
  }
  return global.__persistent_store[key] ?? null;
}

/**
 * Bazaga ma'lumotni saqlash
 */
export async function dbSet(key, value) {
  global.__persistent_store[key] = value;
  if (kv) {
    try {
      await kv.set(key, value);
      return true;
    } catch (err) {
      console.warn(`[KV Set Error] Key ${key}: ${err.message}`);
      return false;
    }
  }
  return true;
}

/**
 * User ilova ma'lumotlarini (xarajatlar, kirimlar, vazifalar) xavfsiz yuklash
 */
export async function getUserAppData(userId) {
  const sUserId = String(userId);
  const defaultData = {
    state: null,
    pending: {},
    expenses: [],
    incomes: [],
    tasks: []
  };

  const raw = await dbGet(`udata:${sUserId}`);
  if (!raw) return defaultData;

  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return {
    state: data.state || null,
    pending: data.pending || {},
    expenses: Array.isArray(data.expenses) ? data.expenses : [],
    incomes: Array.isArray(data.incomes) ? data.incomes : [],
    tasks: Array.isArray(data.tasks) ? data.tasks : []
  };
}

/**
 * User ilova ma'lumotlarini xavfsiz saqlash
 */
export async function saveUserAppData(userId, data) {
  const sUserId = String(userId);
  const safeData = {
    state: data.state || null,
    pending: data.pending || {},
    expenses: Array.isArray(data.expenses) ? data.expenses : [],
    incomes: Array.isArray(data.incomes) ? data.incomes : [],
    tasks: Array.isArray(data.tasks) ? data.tasks : []
  };
  return await dbSet(`udata:${sUserId}`, safeData);
}
