/**
 * Recipient resolver for manual notifications.
 *
 * Pure (no Firebase) so it can be unit-tested and shared by the send service and
 * the live "X kişiye gidecek" count in the UI. Mirrored on web
 * (`zenith_studio_v2/src/utils/recipientResolver.js`) — keep the two in sync.
 *
 * A targeting spec:
 *   { mode: 'all' | 'segment' | 'individuals',
 *     filters: { status?, packageType?, role? },   // segment only, combined with AND
 *     userIds?: string[] }                          // individuals only
 *
 * status   : 'active' (has an active package) | 'pending' (awaiting approval) | 'passive' (approved, no active package)
 * packageType : 'group' | 'one-on-one'  (from the active package)
 * role     : 'member' | 'trainer' | 'admin'
 */

// Users in these account states are never eligible recipients.
const EXCLUDED_STATUS = ['deleted', 'permanently_deleted', 'rejected'];

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Most-recent currently-active package, or null. Same rules as lessonCreditsService. */
export function getActivePackage(userData, now = new Date()) {
  const packages = (userData && userData.packages) || [];
  const active = packages
    .map((pkg) => {
      const expiry = toDate(pkg.expiryDate);
      const start = toDate(pkg.startDate);
      let status = pkg.status;
      if (pkg.status === 'cancelled') status = 'cancelled';
      else if (expiry && expiry < now) status = 'expired';
      else if (start && start > now) status = 'upcoming';
      else if ((pkg.remainingLessons || 0) <= 0) status = 'depleted';
      else status = 'active';
      return { ...pkg, _status: status };
    })
    .filter((pkg) => pkg._status === 'active')
    .sort((a, b) => (toDate(b.startDate)?.getTime() || 0) - (toDate(a.startDate)?.getTime() || 0));
  return active[0] || null;
}

/** Classify a user into { role, status, packageType } for filtering. */
export function classifyUser(userData, now = new Date()) {
  const rawRole = userData.role;
  const role = rawRole === 'instructor' ? 'trainer' : rawRole === 'admin' ? 'admin' : 'member';

  const activePkg = getActivePackage(userData, now);

  // Membership status only applies to members; trainers/admins have none (null),
  // so a status filter never sweeps them in.
  let status = null;
  if (role === 'member') {
    if (userData.status === 'pending') status = 'pending';
    else if (activePkg) status = 'active';
    else status = 'passive';
  }

  const packageType = activePkg ? activePkg.packageType || 'group' : null;
  return { role, status, packageType };
}

function isEligible(userData) {
  return !EXCLUDED_STATUS.includes(userData.status);
}

/**
 * Resolve a targeting spec against a list of user docs ({ id, ...data }).
 * Returns { mode, userIds, count }. For mode 'all', userIds is empty and the
 * caller uses the efficient broadcast path instead.
 */
export function resolveRecipients(spec, users = [], now = new Date()) {
  const mode = spec?.mode || 'all';

  if (mode === 'all') {
    return { mode: 'all', userIds: [], count: users.filter(isEligible).length };
  }

  if (mode === 'individuals') {
    const wanted = new Set(spec.userIds || []);
    const ids = users.filter((u) => wanted.has(u.id) && isEligible(u)).map((u) => u.id);
    return { mode, userIds: ids, count: ids.length };
  }

  // segment — AND across provided filters
  const f = spec.filters || {};
  const ids = users
    .filter(isEligible)
    .filter((u) => {
      const c = classifyUser(u, now);
      if (f.role && c.role !== f.role) return false;
      if (f.status && c.status !== f.status) return false;
      if (f.packageType && c.packageType !== f.packageType) return false;
      return true;
    })
    .map((u) => u.id);

  // de-dupe defensively
  const unique = Array.from(new Set(ids));
  return { mode, userIds: unique, count: unique.length };
}
