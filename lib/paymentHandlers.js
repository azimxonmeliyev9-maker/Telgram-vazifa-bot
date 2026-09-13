/**
 * Telegram UI Flow & Payment Handlers
 */
import { CONFIG } from '../config.js';
import {
  sendMessage,
  editMessageText,
  answerCallbackQuery,
  escapeHtml,
  formatMoney,
  formatDate
} from './telegram.js';
import {
  getSubscription,
  createPendingPayment,
  getPayment,
  approvePayment,
  rejectPayment
} from './subscriptionService.js';

/**
 * 💳 Obuna Menyusini Ko'rsatish
 */
export async function handleSubscriptionMenu(chatId, userId, name) {
  try {
    const sub = await getSubscription(userId);
    const sUserId = String(userId);

    // Admin bo'lsa
    if (sUserId === String(CONFIG.ADMIN_CHAT_ID)) {
      await sendMessage(chatId,
        `💳 <b>OBUNA HOLATI (ADMIN)</b> — ${escapeHtml(name)}\n\n` +
        `👑 <b>Status:</b> CHEKSIZ ADMIN HUQUQI ✅\n` +
        `Barcha funksiyalar va admin paneli siz uchun ochiq.`
      );
      return;
    }

    const now = Date.now();

    // 1. Obuna Faol bo'lsa
    if (sub.status === 'active' && sub.expiresAt && sub.expiresAt > now) {
      const remainingMs = sub.expiresAt - now;
      const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));

      await sendMessage(chatId,
        `💳 <b>OBUNA HOLATI</b> — ${escapeHtml(name)}\n\n` +
        `✅ <b>Status:</b> FAOL\n` +
        `📅 <b>Tugash sanasi:</b> <code>${formatDate(sub.expiresAt)}</code>\n` +
        `⏳ <b>Qolgan vaqt:</b> <code>${remainingDays} kun</code>\n\n` +
        `✨ Barcha funksiyalar (xarajat, vazifa, balans, hisobot, statistika) faol.`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '💳 Obunani Uzaytirish (+30 kun)', callback_data: 'sub_click' }]
            ]
          }
        }
      );
      return;
    }

    // 2. Kutilayotgan To'lov bo'lsa
    if (sub.status === 'awaiting_confirmation' && sub.lastPaymentCode) {
      const payment = await getPayment(sub.lastPaymentCode);
      const code = sub.lastPaymentCode;

      await sendMessage(chatId,
        `💳 <b>OBUNA HOLATI</b> — ${escapeHtml(name)}\n\n` +
        `⏳ <b>Status:</b> TO'LOV KUTILMOQDA (Admin tekshiruvida)\n` +
        `🔑 <b>To'lov kodi:</b> <code>${code}</code>\n` +
        `💵 <b>Summa:</b> ${formatMoney(payment?.amount || CONFIG.SUBSCRIPTION_PRICE)}\n\n` +
        `<i>To'lovingiz admin tasdiqlashi bilanoq obunangiz faollashadi.</i>`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '✅ To\'lov kodini Adminga yuborish', callback_data: `confirm_pay_${code}` }],
              [{ text: '💳 Yangi To\'lov Qilish', callback_data: 'sub_click' }]
            ]
          }
        }
      );
      return;
    }

    // 3. Obuna Yo'q yoki Muddati Tugagan bo'lsa
    const statusText = sub.status === 'expired' ? 'MUDDATI TUGAGAN ❌' : 'FAOL EMAS ❌';

    await sendMessage(chatId,
      `💳 <b>OBUNA SOTIB OLISH</b> — ${escapeHtml(name)}\n\n` +
      `⚠️ <b>Status:</b> ${statusText}\n\n` +
      `📌 <b>Bot imkoniyatlaridan foydalanish uchun 30 kunlik obuna oling:</b>\n` +
      `• 💸 Harajat va Kirimlar hisob-kitobi\n` +
      `• ✅ Vazifalar va 30-min oldin avto-eslatmalar\n` +
      `• 💰 Balans va oylik statistika\n` +
      `• 🗂 Harajatlarni tahrirlash va o'chirish\n\n` +
      `💵 <b>Obuna narxi:</b> <code>${formatMoney(CONFIG.SUBSCRIPTION_PRICE)} / 30 kun</code>\n\n` +
      `👇 To'lov usulini tanlang:`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '💳 Click orqali to\'lov', callback_data: 'sub_click' },
              { text: '💳 Payme orqali to\'lov', callback_data: 'sub_payme' }
            ]
          ]
        }
      }
    );

  } catch (error) {
    console.error('[handleSubscriptionMenu Error]:', error);
    await sendMessage(chatId, `⚠️ Obuna ma'lumotlarini yuklashda xatolik yuz berdi.`);
  }
}

/**
 * To'lov Tizimi Tanlanganda Karta va Noyob Kodni Ko'rsatish
 */
export async function handlePaymentMethodSelect(chatId, userId, username, fullName, method = 'Click') {
  try {
    const payment = await createPendingPayment(userId, username, fullName);

    await sendMessage(chatId,
      `💳 <b>TO'LOV MA'LUMOTLARI (${method.toUpperCase()})</b>\n\n` +
      `1️⃣ Karta raqamiga <b>${formatMoney(payment.amount)}</b> o'tkazing:\n` +
      `💳 Karta: <code>${CONFIG.CARD_NUMBER}</code>\n` +
      `👤 Egasining ismi: <b>${CONFIG.CARD_HOLDER}</b>\n\n` +
      `2️⃣ ⚠️ <b>JUDA MUHIM OGOHLANTIRISH:</b>\n` +
      `To'lov qilayotganda <b>izoh (kommentariya)</b> qismiga ushbu kodni yozing:\n` +
      `🔑 To'lov kodi: <code>${payment.code}</code>\n\n` +
      `3️⃣ O'tkazmani bajargach, pastdagi <b>"✅ To'ladim"</b> tugmasini bosing:`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ To\'ladim (Adminga yuborish)', callback_data: `confirm_pay_${payment.code}` }],
            [{ text: '💳 Menyuga qaytish', callback_data: 'sub_menu' }]
          ]
        }
      }
    );
  } catch (error) {
    console.error('[handlePaymentMethodSelect Error]:', error);
    await sendMessage(chatId, `⚠️ To'lov kodini yaratishda xatolik yuz berdi.`);
  }
}

/**
 * User "✅ To'ladim" tugmasini bossa — Adminga So'rov Yuborish
 */
export async function handleUserPaymentConfirmation(chatId, userId, code, callbackQueryId = null) {
  try {
    if (callbackQueryId) {
      await answerCallbackQuery(callbackQueryId, 'Adminga yuborilmoqda...', false);
    }

    const payment = await getPayment(code);

    if (!payment) {
      await sendMessage(chatId, `❌ To'lov kodi topilmadi.`);
      return;
    }

    if (payment.status !== 'pending') {
      const statusText = payment.status === 'approved' ? 'tasdiqlangan ✅' : 'rad etilgan ❌';
      await sendMessage(chatId, `ℹ️ Ushbu to'lov kodi allaqachon ${statusText}.`);
      return;
    }

    // 1. Userga javob
    await sendMessage(chatId,
      `⏳ <b>TO'LOV ADMINGA YUBORILDI!</b>\n\n` +
      `🔑 To'lov kodi: <code>${payment.code}</code>\n` +
      `💵 Summa: <b>${formatMoney(payment.amount)}</b>\n\n` +
      `<i>Admin to'lovni va izohdagi kodni tekshirib tasdiqlashi bilanoq obunangiz faollashadi.</i>`
    );

    // 2. Adminga xabar yuborish
    const adminMsgText =
      `📥 <b>YANGI TO'LOV TASDIQLASH SO'ROVI</b>\n\n` +
      `👤 <b>Foydalanuvchi:</b> ${escapeHtml(payment.fullName)}\n` +
      `🆔 <b>ID:</b> <code>${payment.userId}</code>\n` +
      `💬 <b>Username:</b> ${payment.username ? '@' + escapeHtml(payment.username) : 'Yo\'q'}\n` +
      `🔑 <b>To'lov kodi:</b> <code>${payment.code}</code>\n` +
      `💵 <b>Summa:</b> ${formatMoney(payment.amount)}\n` +
      `🕒 <b>Vaqt:</b> ${formatDate(payment.createdAt)}\n\n` +
      `👇 To'lovni tekshirib tasdiqlang yoki rad eting:`;

    await sendMessage(CONFIG.ADMIN_CHAT_ID, adminMsgText, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Tasdiqlash', callback_data: `approve_pay_${payment.code}` },
            { text: '❌ Rad etish', callback_data: `reject_pay_${payment.code}` }
          ]
        ]
      }
    });

  } catch (error) {
    console.error('[handleUserPaymentConfirmation Error]:', error);
    await sendMessage(chatId, `⚠️ Xatolik yuz berdi. Iltimos qayta urinib ko'ring.`);
  }
}

/**
 * Admin To'lovni TASDIQLAGANDA (Approve)
 */
export async function handleAdminApproval(adminChatId, code, messageId, callbackQueryId = null) {
  try {
    const { payment, newExpiresAt } = await approvePayment(code, adminChatId);

    if (callbackQueryId) {
      await answerCallbackQuery(callbackQueryId, '✅ To\'lov tasdiqlandi!', true);
    }

    // 1. Admin xabarini tahrirlash (Double-approve prevent)
    const updatedAdminMsg =
      `✅ <b>TO'LOV TASDIQLANDI!</b>\n\n` +
      `👤 <b>Foydalanuvchi:</b> ${escapeHtml(payment.fullName)} (ID: <code>${payment.userId}</code>)\n` +
      `🔑 <b>To'lov kodi:</b> <code>${payment.code}</code>\n` +
      `💵 <b>Summa:</b> ${formatMoney(payment.amount)}\n` +
      `📅 <b>Yangi tugash muddati:</b> <code>${formatDate(newExpiresAt)}</code>\n` +
      `✍️ <b>Tasdiqladi:</b> Admin (${adminChatId})`;

    await editMessageText(adminChatId, messageId, updatedAdminMsg, {
      reply_markup: { inline_keyboard: [] }
    });

    // 2. Foydalanuvchiga xabar yuborish
    const userMsg =
      `🎉 <b>XUSHXABAR! OBUNANGIZ FAOLLASHTIRILDI!</b>\n\n` +
      `✅ Obunangiz <b>30 kun</b>ga muvaffaqiyatli uzaytirildi!\n` +
      `📅 <b>Amal qilish muddati:</b> <code>${formatDate(newExpiresAt)}</code> ga qadar.\n\n` +
      `Rahmat! Botning barcha imkoniyatlaridan to'liq foydalanishingiz mumkin.`;

    await sendMessage(payment.userId, userMsg);

  } catch (error) {
    console.error('[handleAdminApproval Error]:', error.message);
    if (callbackQueryId) {
      await answerCallbackQuery(callbackQueryId, `⚠️ Xato: ${error.message}`, true);
    }
  }
}

/**
 * Admin To'lovni RAD ETGANDA (Reject)
 */
export async function handleAdminRejection(adminChatId, code, messageId, callbackQueryId = null) {
  try {
    const payment = await rejectPayment(code, adminChatId);

    if (callbackQueryId) {
      await answerCallbackQuery(callbackQueryId, '❌ To\'lov rad etildi!', true);
    }

    // 1. Admin xabarini tahrirlash
    const updatedAdminMsg =
      `❌ <b>TO'LOV RAD ETILDI!</b>\n\n` +
      `👤 <b>Foydalanuvchi:</b> ${escapeHtml(payment.fullName)} (ID: <code>${payment.userId}</code>)\n` +
      `🔑 <b>To'lov kodi:</b> <code>${payment.code}</code>\n` +
      `✍️ <b>Rad etdi:</b> Admin (${adminChatId})`;

    await editMessageText(adminChatId, messageId, updatedAdminMsg, {
      reply_markup: { inline_keyboard: [] }
    });

    // 2. Foydalanuvchiga bildirishnoma
    const userMsg =
      `❌ <b>TO'LOVINGIZ RAD ETILDI</b>\n\n` +
      `🔑 To'lov kodi: <code>${payment.code}</code>\n\n` +
      `Siz yuborgan to'lov kodi bo'yicha o'tkazma topilmadi yoki xatolik bor.\n` +
      `Qayta to'lov qilish uchun 💳 Obuna tugmasini bosing.`;

    await sendMessage(payment.userId, userMsg);

  } catch (error) {
    console.error('[handleAdminRejection Error]:', error.message);
    if (callbackQueryId) {
      await answerCallbackQuery(callbackQueryId, `⚠️ Xato: ${error.message}`, true);
    }
  }
}

/**
 * Obunasiz user cheklangan funksiyani ishlatganda chiqariladigan xabar
 */
export async function showSubscriptionRequiredMessage(chatId, name) {
  await sendMessage(chatId,
    `🔒 <b>BOTDAN FOYDALANISH UCHUN OBUNA TALAB QILINADI</b>\n\n` +
    `Hurmatli <b>${escapeHtml(name)}</b>,\n` +
    `Botning xarajatlar, vazifalar, hisobot va statistika funksiyalaridan foydalanish uchun obunani faollashtiring.\n\n` +
    `💵 <b>Obuna narxi:</b> <code>${formatMoney(CONFIG.SUBSCRIPTION_PRICE)} / 30 kun</code>`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💳 Obuna Sotib Olish', callback_data: 'sub_click' }]
        ]
      }
    }
  );
}
