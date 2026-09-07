// Firebase wiring for the transactional booking core (mobile app).
//
// Every seat change in `lessons.participants` and the matching credit change in
// `users/{uid}` go through these functions so they happen in ONE Firestore
// transaction. See bookingCore.js for the logic and packageMath.js for the
// credit rules.

import { runTransaction, doc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../config/firebase';
import { createBookingCore, BookingError } from './bookingCore';

const core = createBookingCore({
  runTransaction,
  doc,
  arrayUnion,
  arrayRemove,
  db,
  lessonsCollection: 'lessons',
  userCollections: ['users'],
  // Mobile credit totals never count expired packages.
  excludeExpired: true,
  // Mobile never wrote `currentParticipants`; keep the customer-side write
  // surface exactly as it was (security rules may be field-restricted).
  writeParticipantCount: false,
});

export { BookingError };
export const isBookingError = (error) => error instanceof BookingError;

export const joinLessonAtomically = core.joinLesson;
export const leaveLessonAtomically = core.leaveLesson;
export const cancelLessonWithRefunds = core.cancelLesson;
export const deleteLessonWithRefunds = core.deleteLesson;
