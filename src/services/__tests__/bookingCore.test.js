import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createBookingCore, BookingError } from '../bookingCore.js';

const NOW = new Date(2026, 8, 7, 10, 0, 0);
const TS = '2026-09-07T07:00:00.000Z';

const coveringPackage = (overrides = {}) => ({
  id: 'pkgA',
  packageName: 'Grup 8',
  startDate: new Date(2026, 8, 1).toISOString(),
  expiryDate: new Date(2026, 8, 30).toISOString(),
  totalLessons: 8,
  remainingLessons: 5,
  status: 'active',
  ...overrides,
});

const baseLesson = (overrides = {}) => ({
  title: 'Grup Reformer',
  scheduledDate: '2026-09-15',
  startTime: '20:00',
  endTime: '20:45',
  maxParticipants: 3,
  participants: ['u0'],
  ...overrides,
});

// In-memory stand-in for a Firestore transaction. It records every write and
// flags the Firestore rule violation "read after write" so the core can be
// checked against the real constraint.
const fakeFirestore = (docs) => {
  const store = new Map(Object.entries(docs));
  const writes = [];
  let readAfterWrite = false;
  const tx = {
    get: async (ref) => {
      if (writes.length > 0) readAfterWrite = true;
      return { exists: () => store.has(ref.path), data: () => store.get(ref.path), id: ref.id };
    },
    update: (ref, data) => writes.push({ type: 'update', path: ref.path, data }),
    delete: (ref) => writes.push({ type: 'delete', path: ref.path }),
  };
  const deps = {
    db: { fake: true },
    runTransaction: async (_db, fn) => fn(tx),
    doc: (_db, col, id) => ({ path: `${col}/${id}`, id, col }),
    arrayUnion: (value) => ({ op: 'arrayUnion', value }),
    arrayRemove: (value) => ({ op: 'arrayRemove', value }),
    now: () => NOW,
  };
  return { deps, writes, get readAfterWrite() { return readAfterWrite; } };
};

const rejectsWithCode = async (promise, code) => {
  await assert.rejects(promise, (err) => {
    assert.ok(err instanceof BookingError, `expected BookingError, got ${err && err.constructor && err.constructor.name}: ${err && err.message}`);
    assert.equal(err.code, code);
    return true;
  });
};

describe('joinLesson', () => {
  test('adds the user with arrayUnion and deducts one credit in the same transaction', async () => {
    const fs = fakeFirestore({
      'lessons/L1': baseLesson(),
      'users/u1': { packages: [coveringPackage()] },
    });
    const core = createBookingCore({ ...fs.deps, excludeExpired: true });

    const result = await core.joinLesson({
      lessonId: 'L1', userId: 'u1', lessonInfo: 'Grup Reformer - 2026-09-15',
      lessonExtra: { updatedAt: 'lesson-ts' }, userExtra: { updatedAt: 'user-ts' }, timestamp: TS,
    });

    assert.equal(result.plan.totalRemaining, 4);
    assert.equal(result.plan.packageName, 'Grup 8');
    assert.equal(fs.writes.length, 2);
    const lessonWrite = fs.writes.find((w) => w.path === 'lessons/L1');
    assert.deepEqual(lessonWrite.data, { participants: { op: 'arrayUnion', value: 'u1' }, updatedAt: 'lesson-ts' });
    const userWrite = fs.writes.find((w) => w.path === 'users/u1');
    assert.equal(userWrite.data.remainingClasses, 4);
    assert.equal(userWrite.data.lessonCredits, 4);
    assert.equal(userWrite.data.packages[0].remainingLessons, 4);
    assert.equal(userWrite.data.packages[0].lastUsedFor, 'Grup Reformer - 2026-09-15');
    assert.equal(userWrite.data.updatedAt, 'user-ts');
    assert.equal(fs.readAfterWrite, false);
  });

  test('writes the participant count too when writeParticipantCount is enabled', async () => {
    const fs = fakeFirestore({ 'lessons/L1': baseLesson(), 'users/u1': { packages: [coveringPackage()] } });
    const core = createBookingCore({ ...fs.deps, writeParticipantCount: true });
    await core.joinLesson({ lessonId: 'L1', userId: 'u1' });
    const lessonWrite = fs.writes.find((w) => w.path === 'lessons/L1');
    assert.equal(lessonWrite.data.currentParticipants, 2);
  });

  test('refuses a full lesson and writes nothing', async () => {
    const fs = fakeFirestore({
      'lessons/L1': baseLesson({ participants: ['a', 'b', 'c'], maxParticipants: 3 }),
      'users/u1': { packages: [coveringPackage()] },
    });
    const core = createBookingCore(fs.deps);
    await rejectsWithCode(core.joinLesson({ lessonId: 'L1', userId: 'u1' }), 'lessonFull');
    assert.equal(fs.writes.length, 0);
  });

  test('treats a missing or zero capacity as unlimited', async () => {
    const fs = fakeFirestore({
      'lessons/L1': baseLesson({ participants: ['a', 'b', 'c'], maxParticipants: undefined }),
      'users/u1': { packages: [coveringPackage()] },
    });
    const core = createBookingCore(fs.deps);
    await core.joinLesson({ lessonId: 'L1', userId: 'u1' });
    assert.equal(fs.writes.length, 2);
  });

  test('refuses a user who is already a participant', async () => {
    const fs = fakeFirestore({ 'lessons/L1': baseLesson({ participants: ['u1'] }), 'users/u1': { packages: [coveringPackage()] } });
    const core = createBookingCore(fs.deps);
    await rejectsWithCode(core.joinLesson({ lessonId: 'L1', userId: 'u1' }), 'alreadyRegistered');
    assert.equal(fs.writes.length, 0);
  });

  test('reports a missing lesson and a missing user', async () => {
    const noLesson = fakeFirestore({ 'users/u1': { packages: [coveringPackage()] } });
    await rejectsWithCode(createBookingCore(noLesson.deps).joinLesson({ lessonId: 'L1', userId: 'u1' }), 'lessonNotFound');
    const noUser = fakeFirestore({ 'lessons/L1': baseLesson() });
    await rejectsWithCode(createBookingCore(noUser.deps).joinLesson({ lessonId: 'L1', userId: 'u1' }), 'userNotFound');
  });

  test('surfaces the credit problem as a BookingError with no writes', async () => {
    const fs = fakeFirestore({
      'lessons/L1': baseLesson(),
      'users/u1': { packages: [coveringPackage({ expiryDate: new Date(2026, 8, 10).toISOString() })] },
    });
    const core = createBookingCore(fs.deps);
    await assert.rejects(core.joinLesson({ lessonId: 'L1', userId: 'u1' }), (err) => {
      assert.equal(err.code, 'noPackageForDate');
      assert.equal(err.data.noPackageForDate, true);
      return true;
    });
    assert.equal(fs.writes.length, 0);
  });

  test('hands the freshly read user and lesson data to validateUser and validateLesson', async () => {
    const fs = fakeFirestore({ 'lessons/L1': baseLesson(), 'users/u1': { packages: [coveringPackage()], membershipStatus: 'active' } });
    const core = createBookingCore(fs.deps);
    const seen = {};
    await core.joinLesson({
      lessonId: 'L1', userId: 'u1',
      validateUser: (userData, lessonData) => { seen.userStatus = userData.membershipStatus; seen.lessonFromUser = lessonData.title; },
      validateLesson: (lessonData, userData) => { seen.lesson = lessonData.title; seen.userFromLesson = userData.membershipStatus; },
    });
    assert.deepEqual(seen, { userStatus: 'active', lessonFromUser: 'Grup Reformer', lesson: 'Grup Reformer', userFromLesson: 'active' });
    assert.equal(fs.writes.length, 2);
  });

  test('aborts with no writes when validateUser rejects the member', async () => {
    const fs = fakeFirestore({ 'lessons/L1': baseLesson(), 'users/u1': { packages: [coveringPackage()], membershipStatus: 'frozen' } });
    const core = createBookingCore(fs.deps);
    await rejectsWithCode(core.joinLesson({
      lessonId: 'L1', userId: 'u1',
      validateUser: (userData) => {
        if (userData.membershipStatus === 'frozen') throw new BookingError('membershipFrozen', 'frozen');
      },
    }), 'membershipFrozen');
    assert.equal(fs.writes.length, 0);
  });

  test('looks the user up in each configured collection in order', async () => {
    const fs = fakeFirestore({ 'lessons/L1': baseLesson(), 'members/u1': { packages: [coveringPackage()] } });
    const core = createBookingCore({ ...fs.deps, userCollections: ['members', 'users'] });
    await core.joinLesson({ lessonId: 'L1', userId: 'u1' });
    assert.ok(fs.writes.some((w) => w.path === 'members/u1'));
  });

  test('accepts lessonInfo as a function of the lesson data', async () => {
    const fs = fakeFirestore({ 'lessons/L1': baseLesson(), 'users/u1': { packages: [coveringPackage()] } });
    const core = createBookingCore(fs.deps);
    await core.joinLesson({ lessonId: 'L1', userId: 'u1', lessonInfo: (l) => `Admin ekledi: ${l.title}` });
    const userWrite = fs.writes.find((w) => w.path === 'users/u1');
    assert.equal(userWrite.data.packages[0].lastUsedFor, 'Admin ekledi: Grup Reformer');
  });
});

describe('leaveLesson', () => {
  test('removes the user with arrayRemove and refunds one credit in the same transaction', async () => {
    const fs = fakeFirestore({
      'lessons/L1': baseLesson({ participants: ['u1', 'u2'] }),
      'users/u1': { packages: [coveringPackage({ remainingLessons: 4 })] },
    });
    const core = createBookingCore(fs.deps);
    const result = await core.leaveLesson({ lessonId: 'L1', userId: 'u1', lessonInfo: 'Ders iptali', lessonExtra: { updatedAt: 'x' }, timestamp: TS });

    assert.equal(result.plan.remainingInPackage, 5);
    const lessonWrite = fs.writes.find((w) => w.path === 'lessons/L1');
    assert.deepEqual(lessonWrite.data, { participants: { op: 'arrayRemove', value: 'u1' }, updatedAt: 'x' });
    const userWrite = fs.writes.find((w) => w.path === 'users/u1');
    assert.equal(userWrite.data.packages[0].remainingLessons, 5);
    assert.equal(userWrite.data.packages[0].lastRefundFor, 'Ders iptali');
    assert.equal(fs.readAfterWrite, false);
  });

  test('decrements the stored participant count when enabled', async () => {
    const fs = fakeFirestore({ 'lessons/L1': baseLesson({ participants: ['u1', 'u2'] }), 'users/u1': { packages: [coveringPackage()] } });
    const core = createBookingCore({ ...fs.deps, writeParticipantCount: true });
    await core.leaveLesson({ lessonId: 'L1', userId: 'u1' });
    assert.equal(fs.writes.find((w) => w.path === 'lessons/L1').data.currentParticipants, 1);
  });

  test('refuses when the user is not a participant', async () => {
    const fs = fakeFirestore({ 'lessons/L1': baseLesson({ participants: ['u2'] }), 'users/u1': { packages: [coveringPackage()] } });
    await rejectsWithCode(createBookingCore(fs.deps).leaveLesson({ lessonId: 'L1', userId: 'u1' }), 'notRegistered');
    assert.equal(fs.writes.length, 0);
  });

  test('still removes a participant whose user document is gone, without a refund', async () => {
    const fs = fakeFirestore({ 'lessons/L1': baseLesson({ participants: ['u1'] }) });
    const result = await createBookingCore(fs.deps).leaveLesson({ lessonId: 'L1', userId: 'u1' });
    assert.equal(result.plan, null);
    assert.equal(fs.writes.length, 1);
    assert.equal(fs.writes[0].path, 'lessons/L1');
  });

  test('can be told to require the user document', async () => {
    const fs = fakeFirestore({ 'lessons/L1': baseLesson({ participants: ['u1'] }) });
    await rejectsWithCode(createBookingCore(fs.deps).leaveLesson({ lessonId: 'L1', userId: 'u1', allowMissingUser: false }), 'userNotFound');
  });

  test('aborts with no writes when validateLesson rejects the cancellation', async () => {
    const fs = fakeFirestore({ 'lessons/L1': baseLesson({ participants: ['u1'] }), 'users/u1': { packages: [coveringPackage()] } });
    await rejectsWithCode(createBookingCore(fs.deps).leaveLesson({
      lessonId: 'L1', userId: 'u1',
      validateLesson: () => { throw new BookingError('cancelTooLate', 'too late', { hoursUntilLesson: 3 }); },
    }), 'cancelTooLate');
    assert.equal(fs.writes.length, 0);
  });
});

describe('cancelLesson / deleteLesson', () => {
  test('refunds every participant it can find, then updates the lesson, all reads first', async () => {
    const fs = fakeFirestore({
      'lessons/L1': baseLesson({ participants: ['u1', 'u2', 'ghost'] }),
      'users/u1': { packages: [coveringPackage({ remainingLessons: 4 })] },
      'users/u2': { remainingClasses: 1 },
    });
    const core = createBookingCore(fs.deps);
    const result = await core.cancelLesson({
      lessonId: 'L1', lessonInfo: (l) => `Ders iptal edildi: ${l.title}`,
      lessonUpdate: { status: 'cancelled', cancelledBy: 'admin1' }, userExtra: { updatedAt: 'ts' },
    });

    assert.deepEqual(result.refunded.map((r) => r.userId), ['u1', 'u2']);
    assert.deepEqual(result.skipped, ['ghost']);
    assert.equal(fs.writes.find((w) => w.path === 'users/u1').data.packages[0].remainingLessons, 5);
    assert.deepEqual(fs.writes.find((w) => w.path === 'users/u2').data, { remainingClasses: 2, lessonCredits: 2, updatedAt: 'ts' });
    const lessonWrite = fs.writes[fs.writes.length - 1];
    assert.equal(lessonWrite.path, 'lessons/L1');
    assert.deepEqual(lessonWrite.data, { status: 'cancelled', cancelledBy: 'admin1' });
    assert.equal(fs.readAfterWrite, false);
  });

  test('deleteLesson refunds and then deletes the lesson document', async () => {
    const fs = fakeFirestore({
      'lessons/L1': baseLesson({ participants: ['u1'] }),
      'users/u1': { packages: [coveringPackage({ remainingLessons: 4 })] },
    });
    const result = await createBookingCore(fs.deps).deleteLesson({ lessonId: 'L1', lessonInfo: 'Ders silindi' });
    assert.equal(result.refunded.length, 1);
    assert.deepEqual(fs.writes[fs.writes.length - 1], { type: 'delete', path: 'lessons/L1' });
  });

  test('cancelLesson reports a missing lesson', async () => {
    const fs = fakeFirestore({});
    await rejectsWithCode(createBookingCore(fs.deps).cancelLesson({ lessonId: 'L1', lessonUpdate: {} }), 'lessonNotFound');
  });
});
