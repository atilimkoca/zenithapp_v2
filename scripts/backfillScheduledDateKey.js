/**
 * One-time migration: backfill `scheduledDateKey` (YYYY-MM-DD local-date string)
 * onto every existing `lessons` document.
 *
 * Why: scheduledDate is stored in mixed formats across docs (full ISO string,
 * plain "YYYY-MM-DD", Firestore Timestamp). Equality and range queries against
 * scheduledDate were silently dropping docs. Going forward, all writes also set
 * `scheduledDateKey`. This script normalizes existing docs so future queries on
 * the new field are complete.
 *
 * Usage:
 *   node scripts/backfillScheduledDateKey.js
 *
 * Reads Firebase credentials from .env (same vars the app uses).
 * Re-run is safe — docs that already have a correct scheduledDateKey are skipped.
 */

require('dotenv/config');
const { initializeApp } = require('firebase/app');
const {
  getFirestore,
  collection,
  getDocs,
  doc,
  writeBatch,
} = require('firebase/firestore');

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID || process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID || process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID || process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

if (!firebaseConfig.projectId) {
  console.error('❌ Missing Firebase config. Ensure .env contains FIREBASE_* vars.');
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const normalizeToDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === 'function') {
    const d = value.toDate();
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value?.seconds === 'number') {
    const d = new Date(value.seconds * 1000);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
};

const toLocalKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const BATCH_SIZE = 400;

const run = async () => {
  console.log(`🚀 Backfilling scheduledDateKey on lessons (project: ${firebaseConfig.projectId})...`);

  const snapshot = await getDocs(collection(db, 'lessons'));
  console.log(`Found ${snapshot.size} lesson docs.`);

  let updated = 0;
  let skipped = 0;
  let invalid = 0;
  let pending = [];

  const flush = async () => {
    if (pending.length === 0) return;
    const batch = writeBatch(db);
    pending.forEach(({ ref, data }) => batch.update(ref, data));
    await batch.commit();
    pending = [];
  };

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const date = normalizeToDate(data.scheduledDate);

    if (!date) {
      invalid += 1;
      console.warn(`⚠️ ${docSnap.id}: cannot parse scheduledDate=`, data.scheduledDate);
      continue;
    }

    const key = toLocalKey(date);

    if (data.scheduledDateKey === key) {
      skipped += 1;
      continue;
    }

    pending.push({
      ref: doc(db, 'lessons', docSnap.id),
      data: { scheduledDateKey: key },
    });
    updated += 1;

    if (pending.length >= BATCH_SIZE) await flush();
  }

  await flush();

  console.log(`✅ Done. updated=${updated} skipped=${skipped} invalid=${invalid}`);
  process.exit(0);
};

run().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
