import { collection, doc, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { sendBroadcastNotificationWithPush } from '../utils/adminNotificationUtils';
import { resolveRecipients, classifyUser } from '../utils/recipientResolver';

const BATCH_SIZE = 450; // < Firestore's 500-write limit, leaves headroom

/**
 * Manual notification sending with segment/individual targeting (mobile admin).
 *
 * - mode 'all'  → existing efficient broadcast (single doc, recipients:'all').
 * - otherwise   → resolve to a userId set, then write one per-user notification
 *   document per recipient (batched). The existing sendPushNotification Cloud
 *   Function delivers each to its user via the per-user push path.
 */
export const manualNotificationService = {
  /** Fetch all users (members + trainers + admins) with the fields the resolver needs. */
  getAudience: async () => {
    try {
      const snap = await getDocs(collection(db, 'users'));
      const users = [];
      snap.forEach((d) => {
        const data = d.data();
        users.push({
          id: d.id,
          firstName: data.firstName,
          lastName: data.lastName,
          displayName: data.displayName,
          email: data.email,
          role: data.role,
          status: data.status,
          packages: data.packages,
          // precomputed classification for list badges
          _class: classifyUser(data),
        });
      });
      return { success: true, users };
    } catch (error) {
      console.error('❌ Error loading audience:', error);
      return { success: false, error: error.code, users: [] };
    }
  },

  /**
   * Send a manual notification.
   * @param spec    targeting spec (see recipientResolver)
   * @param content { title, message, type, priority }
   * @param audience optional pre-fetched user list (avoids a second read)
   */
  send: async (spec, content, audience = null) => {
    try {
      const users = audience || (await manualNotificationService.getAudience()).users;
      const resolved = resolveRecipients(spec, users);

      const title = (content.title || '').trim();
      const message = (content.message || '').trim();
      if (!title || !message) {
        return { success: false, message: 'Başlık ve mesaj zorunludur.' };
      }

      // Broadcast path — unchanged behavior.
      if (resolved.mode === 'all') {
        const res = await sendBroadcastNotificationWithPush(title, message, content.type || 'general');
        return { success: res.success, count: resolved.count, message: res.message };
      }

      if (resolved.userIds.length === 0) {
        return { success: false, count: 0, message: 'Bu kritere uyan kullanıcı yok.' };
      }

      // Per-user path — batched writes; Cloud Function handles push delivery.
      let written = 0;
      let failed = 0;
      for (let i = 0; i < resolved.userIds.length; i += BATCH_SIZE) {
        const chunk = resolved.userIds.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        chunk.forEach((userId) => {
          const ref = doc(collection(db, 'notifications'));
          batch.set(ref, {
            title,
            message,
            type: content.type || 'general',
            priority: content.priority || 'normal',
            recipients: userId,
            userId,
            isRead: false,
            source: 'manual-admin',
            createdAt: serverTimestamp(),
          });
        });
        try {
          await batch.commit();
          written += chunk.length;
        } catch (err) {
          console.error('❌ Batch send failed:', err);
          failed += chunk.length;
        }
      }

      return {
        success: written > 0,
        count: written,
        failed,
        message:
          failed > 0
            ? `${written} kişiye gönderildi, ${failed} kişide hata oluştu.`
            : `${written} kişiye gönderildi.`,
      };
    } catch (error) {
      console.error('❌ Error sending manual notification:', error);
      return { success: false, message: 'Bildirim gönderilemedi: ' + error.message };
    }
  },

  resolveRecipients,
};

export default manualNotificationService;
