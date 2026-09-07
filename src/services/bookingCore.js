// Transaction bodies for joining / leaving / cancelling lessons.
//
// Everything here runs inside ONE Firestore transaction so that the seat in
// `lessons.participants` and the credit in the member's document always change
// together, and so that a concurrent writer can never overwrite the seat with a
// stale copy of the participants array (arrayUnion / arrayRemove are used).
//
// Firebase is injected (`runTransaction`, `doc`, `arrayUnion`, `arrayRemove`,
// `db`) so the logic can be unit-tested with an in-memory fake. The real wiring
// lives in `bookingTransactions.js`.
//
// The identical copy of this file lives in the other project. Keep them in sync.

import { planDeduction, planRefund } from './packageMath.js';

export class BookingError extends Error {
  constructor(code, message, data = {}) {
    super(message || code);
    this.name = 'BookingError';
    this.code = code;
    this.data = data;
  }
}

const resolveLessonInfo = (lessonInfo, lessonData) => {
  if (typeof lessonInfo === 'function') return lessonInfo(lessonData);
  if (typeof lessonInfo === 'string') return lessonInfo;
  return `${lessonData.title || ''} - ${lessonData.scheduledDate || ''}`.trim();
};

// A missing or zero capacity means "no limit" (some legacy lessons have none).
const capacityOf = (lessonData) => {
  const max = Number(lessonData.maxParticipants ?? lessonData.maxStudents);
  return Number.isFinite(max) && max > 0 ? max : null;
};

const participantsOf = (lessonData) =>
  (Array.isArray(lessonData.participants) ? lessonData.participants : []);

export const createBookingCore = ({
  runTransaction,
  doc,
  arrayUnion,
  arrayRemove,
  db,
  lessonsCollection = 'lessons',
  userCollections = ['users'],
  excludeExpired = false,
  writeParticipantCount = false,
  now = () => new Date(),
}) => {
  const readLesson = async (tx, lessonId) => {
    const ref = doc(db, lessonsCollection, lessonId);
    const snap = await tx.get(ref);
    if (!snap.exists()) {
      throw new BookingError('lessonNotFound', 'Lesson not found');
    }
    return { ref, data: snap.data() };
  };

  // The admin web app keeps members in `members/` with a fallback to `users/`;
  // the mobile app only has `users/`. Collections are tried in order.
  const readUser = async (tx, userId) => {
    for (const collectionName of userCollections) {
      const ref = doc(db, collectionName, userId);
      const snap = await tx.get(ref);
      if (snap.exists()) {
        return { ref, data: snap.data(), collection: collectionName };
      }
    }
    return null;
  };

  const planOptions = (current, timestamp) => ({
    now: current,
    excludeExpired,
    timestamp: timestamp || current.toISOString(),
  });

  const joinLesson = ({
    lessonId,
    userId,
    lessonInfo,
    validateUser,
    validateLesson,
    lessonExtra = {},
    userExtra = {},
    timestamp,
  } = {}) => runTransaction(db, async (tx) => {
    const current = now();

    // All reads first — Firestore rejects reads after writes in a transaction.
    const lesson = await readLesson(tx, lessonId);
    const user = await readUser(tx, userId);
    if (!user) {
      throw new BookingError('userNotFound', 'User not found');
    }

    if (validateUser) await validateUser(user.data, lesson.data);
    if (validateLesson) await validateLesson(lesson.data, user.data);

    const participants = participantsOf(lesson.data);
    if (participants.includes(userId)) {
      throw new BookingError('alreadyRegistered', 'Already registered for this lesson');
    }

    const capacity = capacityOf(lesson.data);
    if (capacity !== null && participants.length >= capacity) {
      throw new BookingError('lessonFull', 'Lesson is full');
    }

    const plan = planDeduction(
      user.data,
      lesson.data.scheduledDate,
      resolveLessonInfo(lessonInfo, lesson.data),
      planOptions(current, timestamp),
    );
    if (!plan.ok) {
      throw new BookingError(plan.code, plan.message, { noPackageForDate: plan.noPackageForDate === true });
    }

    const lessonUpdate = { participants: arrayUnion(userId), ...lessonExtra };
    if (writeParticipantCount) {
      lessonUpdate.currentParticipants = participants.length + 1;
    }

    tx.update(lesson.ref, lessonUpdate);
    tx.update(user.ref, { ...plan.updateData, ...userExtra });

    return { lessonData: lesson.data, userData: user.data, userCollection: user.collection, plan };
  });

  const leaveLesson = ({
    lessonId,
    userId,
    lessonInfo,
    validateLesson,
    allowMissingUser = true,
    lessonExtra = {},
    userExtra = {},
    timestamp,
  } = {}) => runTransaction(db, async (tx) => {
    const current = now();

    const lesson = await readLesson(tx, lessonId);
    const user = await readUser(tx, userId);
    if (!user && !allowMissingUser) {
      throw new BookingError('userNotFound', 'User not found');
    }

    const participants = participantsOf(lesson.data);
    if (!participants.includes(userId)) {
      throw new BookingError('notRegistered', 'Not registered for this lesson');
    }

    if (validateLesson) await validateLesson(lesson.data, user ? user.data : null);

    const plan = user
      ? planRefund(
        user.data,
        lesson.data.scheduledDate,
        resolveLessonInfo(lessonInfo, lesson.data),
        planOptions(current, timestamp),
      )
      : null;

    const lessonUpdate = { participants: arrayRemove(userId), ...lessonExtra };
    if (writeParticipantCount) {
      lessonUpdate.currentParticipants = Math.max(0, participants.length - 1);
    }

    tx.update(lesson.ref, lessonUpdate);
    if (user && plan) {
      tx.update(user.ref, { ...plan.updateData, ...userExtra });
    }

    return { lessonData: lesson.data, userData: user ? user.data : null, plan };
  });

  // Refund every participant of a lesson (used by cancel and delete).
  // Reads all user documents before issuing any write.
  const refundParticipants = async (tx, lesson, { lessonInfo, userExtra, timestamp, current }) => {
    const participantIds = [...new Set(participantsOf(lesson.data))];
    const lookups = [];
    for (const userId of participantIds) {
      lookups.push({ userId, user: await readUser(tx, userId) });
    }

    const refunded = [];
    const skipped = [];
    for (const { userId, user } of lookups) {
      if (!user) {
        skipped.push(userId);
        continue;
      }
      const plan = planRefund(
        user.data,
        lesson.data.scheduledDate,
        resolveLessonInfo(lessonInfo, lesson.data),
        planOptions(current, timestamp),
      );
      tx.update(user.ref, { ...plan.updateData, ...userExtra });
      refunded.push({ userId, plan });
    }

    return { refunded, skipped };
  };

  const cancelLesson = ({ lessonId, lessonInfo, lessonUpdate = {}, userExtra = {}, timestamp } = {}) =>
    runTransaction(db, async (tx) => {
      const current = now();
      const lesson = await readLesson(tx, lessonId);
      const outcome = await refundParticipants(tx, lesson, { lessonInfo, userExtra, timestamp, current });
      tx.update(lesson.ref, lessonUpdate);
      return { lessonData: lesson.data, ...outcome };
    });

  const deleteLesson = ({ lessonId, lessonInfo, userExtra = {}, timestamp } = {}) =>
    runTransaction(db, async (tx) => {
      const current = now();
      const lesson = await readLesson(tx, lessonId);
      const outcome = await refundParticipants(tx, lesson, { lessonInfo, userExtra, timestamp, current });
      tx.delete(lesson.ref);
      return { lessonData: lesson.data, ...outcome };
    });

  return { joinLesson, leaveLesson, cancelLesson, deleteLesson };
};
