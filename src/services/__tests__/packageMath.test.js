import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  toDate,
  migrateLegacyPackage,
  resolvePackages,
  getPackagesForDate,
  computeTotalRemaining,
  planDeduction,
  planRefund,
} from '../packageMath.js';

// Fixed "now": 7 Sept 2026, 10:00 local time.
const NOW = new Date(2026, 8, 7, 10, 0, 0);
const TS = '2026-09-07T07:00:00.000Z';

const makePackage = (overrides = {}) => ({
  id: 'pkgA',
  packageName: 'Grup 8',
  packageType: 'group',
  startDate: new Date(2026, 8, 1).toISOString(),
  expiryDate: new Date(2026, 8, 30).toISOString(),
  totalLessons: 8,
  remainingLessons: 5,
  status: 'active',
  ...overrides,
});

describe('toDate', () => {
  test('parses a date-only string as local midnight', () => {
    const d = toDate('2026-09-07');
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 8);
    assert.equal(d.getDate(), 7);
    assert.equal(d.getHours(), 0);
  });

  test('accepts Date, Firestore-like {seconds} and {toDate()} values', () => {
    const real = new Date(2026, 0, 1);
    assert.equal(toDate(real), real);
    assert.equal(toDate({ seconds: 1000 }).getTime(), 1000 * 1000);
    assert.equal(toDate({ toDate: () => new Date(5000) }).getTime(), 5000);
  });

  test('returns null for empty or invalid input', () => {
    assert.equal(toDate(null), null);
    assert.equal(toDate(''), null);
    assert.equal(toDate('not a date'), null);
  });
});

describe('migrateLegacyPackage', () => {
  test('returns null when the user has neither packageInfo nor packageExpiryDate', () => {
    assert.equal(migrateLegacyPackage({ remainingClasses: 4 }), null);
  });

  test('builds a legacy package from packageInfo with the remaining count', () => {
    const legacy = migrateLegacyPackage({
      packageInfo: { remainingClasses: 3, packageName: 'Eski Paket', packageId: 'cat1' },
      packageStartDate: new Date(2026, 8, 1).toISOString(),
      packageExpiryDate: new Date(2026, 8, 30).toISOString(),
      totalClasses: 8,
    });
    assert.equal(legacy.remainingLessons, 3);
    assert.equal(legacy.totalLessons, 8);
    assert.equal(legacy.packageName, 'Eski Paket');
    assert.equal(legacy.isLegacy, true);
    assert.equal(legacy.status, 'active');
  });
});

describe('resolvePackages', () => {
  test('recomputes expired / upcoming / depleted / active statuses from dates and credits', () => {
    const packages = [
      makePackage({ id: 'expired', expiryDate: new Date(2026, 7, 31).toISOString(), status: 'active' }),
      makePackage({ id: 'upcoming', startDate: new Date(2026, 9, 1).toISOString(), expiryDate: new Date(2026, 10, 1).toISOString(), status: 'active' }),
      makePackage({ id: 'depleted', remainingLessons: 0, status: 'active' }),
      makePackage({ id: 'active', status: 'depleted' }),
    ];
    const resolved = resolvePackages({ packages }, { now: NOW });
    const byId = Object.fromEntries(resolved.map((p) => [p.id, p.status]));
    assert.deepEqual(byId, { expired: 'expired', upcoming: 'upcoming', depleted: 'depleted', active: 'active' });
  });

  test('keeps a cancelled package cancelled even if its dates are current', () => {
    const resolved = resolvePackages({ packages: [makePackage({ status: 'cancelled' })] }, { now: NOW });
    assert.equal(resolved[0].status, 'cancelled');
  });

  test('does not mutate the caller\'s package objects', () => {
    const original = makePackage({ id: 'x', expiryDate: new Date(2026, 7, 31).toISOString(), status: 'active' });
    resolvePackages({ packages: [original] }, { now: NOW });
    assert.equal(original.status, 'active');
  });

  test('migrates legacy packageInfo when the packages array is empty', () => {
    const resolved = resolvePackages({
      packages: [],
      packageInfo: { remainingClasses: 2, packageName: 'Eski' },
      packageStartDate: new Date(2026, 8, 1).toISOString(),
      packageExpiryDate: new Date(2026, 8, 30).toISOString(),
    }, { now: NOW });
    assert.equal(resolved.length, 1);
    assert.equal(resolved[0].remainingLessons, 2);
    assert.equal(resolved[0].isLegacy, true);
  });
});

describe('getPackagesForDate', () => {
  const lessonDay = new Date(2026, 8, 15);

  test('returns packages whose date range covers the lesson and that still have credits', () => {
    const eligible = getPackagesForDate([makePackage()], lessonDay);
    assert.equal(eligible.length, 1);
  });

  test('is inclusive of the start and expiry days', () => {
    const p = makePackage();
    assert.equal(getPackagesForDate([p], new Date(2026, 8, 1, 18)).length, 1);
    assert.equal(getPackagesForDate([p], new Date(2026, 8, 30, 18)).length, 1);
    assert.equal(getPackagesForDate([p], new Date(2026, 9, 1)).length, 0);
  });

  test('excludes cancelled and depleted packages', () => {
    const packages = [makePackage({ status: 'cancelled' }), makePackage({ id: 'b', remainingLessons: 0 })];
    assert.equal(getPackagesForDate(packages, lessonDay).length, 0);
  });
});

describe('computeTotalRemaining', () => {
  const packages = [
    makePackage({ id: 'a', remainingLessons: 4 }),
    makePackage({ id: 'expired', remainingLessons: 2, expiryDate: new Date(2026, 7, 31).toISOString() }),
    makePackage({ id: 'cancelled', remainingLessons: 9, status: 'cancelled' }),
  ];

  test('sums non-cancelled packages, including expired ones by default', () => {
    assert.equal(computeTotalRemaining(packages, { now: NOW }), 6);
  });

  test('drops expired packages when excludeExpired is set', () => {
    assert.equal(computeTotalRemaining(packages, { now: NOW, excludeExpired: true }), 4);
  });
});

describe('planDeduction', () => {
  const lessonDate = new Date(2026, 8, 15).toISOString();

  test('legacy user without packages: decrements the root credit fields', () => {
    const plan = planDeduction({ remainingClasses: 2 }, lessonDate, 'Ders', { now: NOW, timestamp: TS });
    assert.equal(plan.ok, true);
    assert.equal(plan.usedLegacyDeduction, true);
    assert.deepEqual(plan.updateData, { remainingClasses: 1, lessonCredits: 1 });
    assert.equal(plan.totalRemaining, 1);
  });

  test('legacy user with no credits is refused with insufficientCredits', () => {
    const plan = planDeduction({ remainingClasses: 0 }, lessonDate, 'Ders', { now: NOW });
    assert.equal(plan.ok, false);
    assert.equal(plan.code, 'insufficientCredits');
  });

  test('deducts one lesson from the first package covering the date and records what it was used for', () => {
    const covering = makePackage({ id: 'A', remainingLessons: 5 });
    const later = makePackage({ id: 'B', remainingLessons: 3, startDate: new Date(2026, 9, 1).toISOString(), expiryDate: new Date(2026, 10, 1).toISOString() });
    const plan = planDeduction({ packages: [covering, later] }, lessonDate, 'Grup Reformer - 15.09', { now: NOW, timestamp: TS });

    assert.equal(plan.ok, true);
    assert.equal(plan.packageId, 'A');
    assert.equal(plan.packageName, 'Grup 8');
    assert.equal(plan.remainingInPackage, 4);
    const updatedA = plan.updateData.packages.find((p) => p.id === 'A');
    assert.equal(updatedA.remainingLessons, 4);
    assert.equal(updatedA.lastUsedFor, 'Grup Reformer - 15.09');
    assert.equal(updatedA.lastUsedAt, TS);
    assert.equal(plan.updateData.packages.find((p) => p.id === 'B').remainingLessons, 3);
    assert.equal(plan.updateData.remainingClasses, 7);
    assert.equal(plan.updateData.lessonCredits, 7);
    assert.equal(plan.totalRemaining, 7);
    assert.equal('packageInfo.remainingClasses' in plan.updateData, false);
  });

  test('syncs packageInfo.remainingClasses only when the user has a packageInfo object', () => {
    const plan = planDeduction(
      { packages: [makePackage({ remainingLessons: 5 })], packageInfo: { remainingClasses: 5 } },
      lessonDate, 'Ders', { now: NOW, timestamp: TS },
    );
    assert.equal(plan.updateData['packageInfo.remainingClasses'], 4);
  });

  test('refuses with noPackageForDate when no package covers the lesson date', () => {
    const plan = planDeduction({ packages: [makePackage({ expiryDate: new Date(2026, 8, 10).toISOString() })] }, lessonDate, 'Ders', { now: NOW });
    assert.equal(plan.ok, false);
    assert.equal(plan.code, 'noPackageForDate');
    assert.equal(plan.noPackageForDate, true);
  });

  test('refuses with insufficientCredits when the covering package is depleted', () => {
    const plan = planDeduction({ packages: [makePackage({ remainingLessons: 0 })] }, lessonDate, 'Ders', { now: NOW });
    assert.equal(plan.ok, false);
    assert.equal(plan.code, 'insufficientCredits');
  });

  test('excludeExpired controls whether expired credits count toward the total', () => {
    const packages = [
      makePackage({ id: 'A', remainingLessons: 5 }),
      makePackage({ id: 'E', remainingLessons: 2, expiryDate: new Date(2026, 7, 31).toISOString() }),
    ];
    const withExpired = planDeduction({ packages }, lessonDate, 'Ders', { now: NOW, excludeExpired: false });
    const withoutExpired = planDeduction({ packages }, lessonDate, 'Ders', { now: NOW, excludeExpired: true });
    assert.equal(withExpired.totalRemaining, 6);
    assert.equal(withoutExpired.totalRemaining, 4);
  });
});

describe('planRefund', () => {
  const lessonDate = new Date(2026, 8, 15).toISOString();

  test('refunds one lesson to the package covering the date and records the reason', () => {
    const plan = planRefund({ packages: [makePackage({ remainingLessons: 4 })] }, lessonDate, 'Ders iptali', { now: NOW, timestamp: TS });
    assert.equal(plan.ok, true);
    assert.equal(plan.packageId, 'pkgA');
    assert.equal(plan.remainingInPackage, 5);
    const updated = plan.updateData.packages[0];
    assert.equal(updated.remainingLessons, 5);
    assert.equal(updated.lastRefundFor, 'Ders iptali');
    assert.equal(updated.lastRefundAt, TS);
    assert.equal(plan.updateData.remainingClasses, 5);
    assert.equal(plan.updateData.lessonCredits, 5);
  });

  test('never refunds above the package total', () => {
    const plan = planRefund({ packages: [makePackage({ remainingLessons: 8, totalLessons: 8 })] }, lessonDate, 'Ders iptali', { now: NOW });
    assert.equal(plan.updateData.packages[0].remainingLessons, 8);
  });

  test('falls back to the most recent active package when none covers the date', () => {
    const older = makePackage({ id: 'old', startDate: new Date(2026, 8, 20).toISOString(), expiryDate: new Date(2026, 9, 20).toISOString(), remainingLessons: 1 });
    const newer = makePackage({ id: 'new', startDate: new Date(2026, 8, 25).toISOString(), expiryDate: new Date(2026, 9, 25).toISOString(), remainingLessons: 1 });
    const plan = planRefund({ packages: [older, newer] }, new Date(2026, 8, 5).toISOString(), 'Ders iptali', { now: NOW });
    assert.equal(plan.packageId, 'new');
    assert.equal(plan.updateData.packages.find((p) => p.id === 'new').remainingLessons, 2);
    assert.equal(plan.updateData.packages.find((p) => p.id === 'old').remainingLessons, 1);
  });

  test('legacy user without packages: increments the root credit fields', () => {
    const plan = planRefund({ remainingClasses: 2 }, lessonDate, 'Ders iptali', { now: NOW });
    assert.equal(plan.ok, true);
    assert.equal(plan.usedLegacyRefund, true);
    assert.deepEqual(plan.updateData, { remainingClasses: 3, lessonCredits: 3 });
  });

  test('user with only packageInfo gets the refund on the migrated legacy package and packageInfo stays in sync', () => {
    const plan = planRefund({
      packages: [],
      packageInfo: { remainingClasses: 2, packageName: 'Eski' },
      packageStartDate: new Date(2026, 8, 1).toISOString(),
      packageExpiryDate: new Date(2026, 8, 30).toISOString(),
      totalClasses: 8,
    }, lessonDate, 'Ders iptali', { now: NOW });
    assert.equal(plan.updateData.packages.length, 1);
    assert.equal(plan.updateData.packages[0].remainingLessons, 3);
    assert.equal(plan.updateData['packageInfo.remainingClasses'], 3);
  });
});
