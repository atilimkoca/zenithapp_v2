// Pure package / lesson-credit math shared by the mobile app and the admin web app.
//
// This module has NO Firebase imports on purpose. Callers read the user
// document (inside a Firestore transaction), hand the data to these functions
// and write back the `updateData` they return. That keeps the business rules
// testable in plain Node and guarantees both apps compute credits identically.
//
// Differences between the two apps are expressed through options:
//   - `excludeExpired`: mobile does not count expired packages toward the total
//     credit figure; the admin web app counts every non-cancelled package.
//
// The identical copy of this file lives in the other project. Keep them in sync.

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Normalise Date / Firestore Timestamp / {seconds} / string values into a Date.
 * Date-only strings ("2026-09-07") are parsed as LOCAL midnight so that a lesson
 * stored as a plain date never slides to the previous day in UTC+ timezones.
 */
export const toDate = (value) => {
  if (!value && value !== 0) return null;

  let parsed = null;
  if (value instanceof Date) {
    parsed = value;
  } else if (typeof value.toDate === 'function') {
    try {
      parsed = value.toDate();
    } catch {
      parsed = null;
    }
  } else if (typeof value.seconds === 'number') {
    parsed = new Date(value.seconds * 1000);
  } else if (typeof value === 'string') {
    if (DATE_ONLY_PATTERN.test(value)) {
      const [year, month, day] = value.split('-').map(Number);
      parsed = new Date(year, month - 1, day);
    } else {
      parsed = new Date(value);
    }
  } else if (typeof value === 'number') {
    parsed = new Date(value);
  }

  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
};

/**
 * Build a virtual package from the legacy single-package fields
 * (`packageInfo`, `packageStartDate`, `packageExpiryDate`, root credits).
 * Returns null when the user has no legacy package data worth migrating.
 */
export const migrateLegacyPackage = (userData, { now = new Date() } = {}) => {
  const data = userData || {};
  if (!data.packageInfo && !data.packageExpiryDate) {
    return null;
  }

  const packageInfo = data.packageInfo || {};
  const remainingClasses = packageInfo.remainingClasses !== undefined
    ? packageInfo.remainingClasses
    : (data.remainingClasses || data.lessonCredits || 0);

  if (remainingClasses <= 0 && !data.packageExpiryDate) {
    return null;
  }

  // Root-level totals win over packageInfo.lessonCount, which older migrations
  // sometimes filled with the *remaining* count instead of the total.
  const totalLessons = data.totalLessons
    || data.totalClasses
    || packageInfo.totalLessons
    || packageInfo.lessonCount
    || packageInfo.classes
    || packageInfo.sessions
    || remainingClasses;

  const nowISO = now.toISOString();

  return {
    id: packageInfo.packageId || `legacy_${data.id || now.getTime()}`,
    packageId: packageInfo.packageId || null,
    packageName: packageInfo.packageName || data.packageName || 'Mevcut Paket',
    packageType: packageInfo.packageType || data.packageType || 'group',
    startDate: data.packageStartDate || packageInfo.assignedAt || data.approvedAt || nowISO,
    expiryDate: data.packageExpiryDate || packageInfo.expiryDate || nowISO,
    totalLessons,
    remainingLessons: remainingClasses,
    assignedAt: packageInfo.assignedAt || data.approvedAt || nowISO,
    assignedBy: data.approvedBy || 'system_migration',
    status: 'active',
    isLegacy: true,
  };
};

const computeStatus = (pkg, now) => {
  if (pkg.status === 'cancelled') return 'cancelled';
  const expiry = toDate(pkg.expiryDate);
  const start = toDate(pkg.startDate);
  if (expiry && expiry < now) return 'expired';
  if (start && start > now) return 'upcoming';
  if ((pkg.remainingLessons || 0) <= 0) return 'depleted';
  return 'active';
};

/**
 * The user's packages with their status recomputed for `now`.
 * Falls back to a migrated legacy package when the array is empty.
 * Never mutates the input.
 */
export const resolvePackages = (userData, { now = new Date() } = {}) => {
  const data = userData || {};
  let packages = Array.isArray(data.packages) ? data.packages : [];

  if (packages.length === 0 && data.packageInfo) {
    const legacy = migrateLegacyPackage(data, { now });
    packages = legacy ? [legacy] : [];
  }

  return packages.map((pkg) => ({ ...pkg, status: computeStatus(pkg, now) }));
};

const coversDate = (pkg, noon) => {
  const start = toDate(pkg.startDate);
  const expiry = toDate(pkg.expiryDate);
  if (!start || !expiry) return false;
  const startOfDay = new Date(start);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(expiry);
  endOfDay.setHours(23, 59, 59, 999);
  return startOfDay <= noon && endOfDay >= noon;
};

const noonOf = (targetDate) => {
  const date = toDate(targetDate);
  if (!date) return null;
  const noon = new Date(date);
  noon.setHours(12, 0, 0, 0);
  return noon;
};

// Non-cancelled packages whose date range includes the target day (credits ignored).
const packagesCoveringDate = (packages, targetDate) => {
  const noon = noonOf(targetDate);
  if (!noon) return [];
  return (packages || []).filter((pkg) => pkg.status !== 'cancelled' && coversDate(pkg, noon));
};

/**
 * Packages that can pay for a lesson on `targetDate`: cover the day, are not
 * cancelled and still have credits. Start and expiry days are inclusive.
 */
export const getPackagesForDate = (packages, targetDate) =>
  packagesCoveringDate(packages, targetDate).filter((pkg) => (pkg.remainingLessons || 0) > 0);

/**
 * Total remaining credits across non-cancelled packages.
 * With `excludeExpired`, packages whose expiry is before `now` are not counted.
 */
export const computeTotalRemaining = (packages, { now = new Date(), excludeExpired = false } = {}) =>
  (packages || []).reduce((sum, pkg) => {
    if (pkg.status === 'cancelled') return sum;
    if (excludeExpired) {
      const expiry = toDate(pkg.expiryDate);
      if (expiry && expiry < now) return sum;
    }
    return sum + (pkg.remainingLessons || 0);
  }, 0);

const hasPackageArray = (data) => Array.isArray(data.packages) && data.packages.length > 0;
const hasPackageInfo = (data) =>
  !!data.packageInfo && typeof data.packageInfo === 'object' && Object.keys(data.packageInfo).length > 0;

/**
 * Work out how one lesson credit should be deducted for a lesson on `lessonDate`.
 * Returns either `{ ok: true, updateData, ... }` or `{ ok: false, code, message }`.
 * `updateData` never includes `updatedAt`; the caller adds it in its own format.
 */
export const planDeduction = (userData, lessonDate, lessonInfo = '', options = {}) => {
  const { now = new Date(), excludeExpired = false } = options;
  const timestamp = options.timestamp || now.toISOString();
  const data = userData || {};

  // Legacy account: no package array and no packageInfo → plain root counters.
  if (!hasPackageArray(data) && !hasPackageInfo(data)) {
    const current = data.remainingClasses || data.lessonCredits || 0;
    if (current <= 0) {
      return { ok: false, code: 'insufficientCredits', message: 'Kalan ders hakkı yok' };
    }
    return {
      ok: true,
      usedLegacyDeduction: true,
      packageId: null,
      packageName: null,
      remainingInPackage: current - 1,
      totalRemaining: current - 1,
      updateData: { remainingClasses: current - 1, lessonCredits: current - 1 },
    };
  }

  const packages = resolvePackages(data, { now });
  const eligible = getPackagesForDate(packages, lessonDate);

  if (eligible.length === 0) {
    if (packagesCoveringDate(packages, lessonDate).length > 0) {
      return { ok: false, code: 'insufficientCredits', message: 'Pakette kalan ders yok' };
    }
    return {
      ok: false,
      code: 'noPackageForDate',
      noPackageForDate: true,
      message: 'Bu tarih için geçerli bir paket bulunamadı',
    };
  }

  const target = eligible[0];
  const updatedPackages = packages.map((pkg) => (
    pkg.id === target.id
      ? { ...pkg, remainingLessons: pkg.remainingLessons - 1, lastUsedAt: timestamp, lastUsedFor: lessonInfo }
      : pkg
  ));

  const totalRemaining = computeTotalRemaining(updatedPackages, { now, excludeExpired });
  const updateData = {
    packages: updatedPackages,
    remainingClasses: totalRemaining,
    lessonCredits: totalRemaining,
  };
  if (data.packageInfo) {
    updateData['packageInfo.remainingClasses'] = totalRemaining;
  }

  return {
    ok: true,
    usedLegacyDeduction: false,
    packageId: target.id,
    packageName: target.packageName,
    remainingInPackage: target.remainingLessons - 1,
    totalRemaining,
    updateData,
  };
};

/**
 * Work out how one lesson credit should be refunded for a lesson on `lessonDate`.
 * Prefers the package covering the lesson day, then the most recent active
 * package, then the last package. Never refunds above `totalLessons`.
 */
export const planRefund = (userData, lessonDate, lessonInfo = '', options = {}) => {
  const { now = new Date(), excludeExpired = false } = options;
  const timestamp = options.timestamp || now.toISOString();
  const data = userData || {};

  const packages = resolvePackages(data, { now });

  if (packages.length === 0) {
    const current = data.remainingClasses || data.lessonCredits || 0;
    return {
      ok: true,
      usedLegacyRefund: true,
      packageId: null,
      packageName: null,
      remainingInPackage: current + 1,
      totalRemaining: current + 1,
      updateData: { remainingClasses: current + 1, lessonCredits: current + 1 },
    };
  }

  let target = packagesCoveringDate(packages, lessonDate)[0] || null;

  if (!target) {
    const activePackages = packages
      .filter((pkg) => {
        if (pkg.status === 'cancelled') return false;
        const expiry = toDate(pkg.expiryDate);
        return !!expiry && expiry >= now;
      })
      .sort((a, b) => {
        const startB = toDate(b.startDate);
        const startA = toDate(a.startDate);
        return (startB ? startB.getTime() : 0) - (startA ? startA.getTime() : 0);
      });
    target = activePackages[0] || packages[packages.length - 1];
  }

  const updatedPackages = packages.map((pkg) => {
    if (pkg.id !== target.id) return pkg;
    const newRemaining = (pkg.remainingLessons || 0) + 1;
    const maxLessons = pkg.totalLessons || newRemaining;
    return {
      ...pkg,
      remainingLessons: Math.min(newRemaining, maxLessons),
      lastRefundAt: timestamp,
      lastRefundFor: lessonInfo,
    };
  });

  const totalRemaining = computeTotalRemaining(updatedPackages, { now, excludeExpired });
  const updateData = {
    packages: updatedPackages,
    remainingClasses: totalRemaining,
    lessonCredits: totalRemaining,
  };
  if (data.packageInfo) {
    updateData['packageInfo.remainingClasses'] = totalRemaining;
  }

  const refunded = updatedPackages.find((pkg) => pkg.id === target.id);

  return {
    ok: true,
    usedLegacyRefund: false,
    packageId: target.id,
    packageName: target.packageName,
    remainingInPackage: refunded ? refunded.remainingLessons : 0,
    totalRemaining,
    updateData,
  };
};
