// Deleting a member is a SOFT delete in both admin panels: the document stays
// in Firestore, marked as deleted and with login disabled, so the record can be
// audited (Raporlar → Silinen Üyeler) and restored. Nothing is destroyed.
//
// This module builds that payload. It is duplicated byte-for-byte in the mobile
// project so both panels write exactly the same shape — that equality is the
// whole point, so keep the two copies in sync.

export const DELETED_STATUS = 'permanently_deleted';
export const DELETION_REASON = 'Admin panel deletion';

/**
 * @param {object}  memberData    the member document as it looks right now (kept for restore)
 * @param {string?} deletedBy     uid of the admin performing the deletion
 * @param {string?} deletedByName that admin's display name, resolved for readability
 * @param {'web'|'mobile'} deletedFrom which panel the deletion came from
 * @param {Date}    now
 * @returns {object} fields to merge into the member document (no `updatedAt`:
 *                   the web stamps a serverTimestamp, the mobile app an ISO string)
 */
export const buildDeletionPayload = ({
  memberData,
  deletedBy = null,
  deletedByName = null,
  deletedFrom,
  now = new Date(),
}) => ({
  status: DELETED_STATUS,
  membershipStatus: 'deleted',
  deletedAt: now.toISOString(),
  // 'admin' is what every record written before 2026-09-08 carries; keeping it
  // as the fallback means old and new records read the same way.
  deletedBy: deletedBy || 'admin',
  deletedByName: deletedByName || null,
  deletedFrom,
  deletionReason: DELETION_REASON,
  // Snapshot for the audit trail and for restoring the member later.
  originalData: memberData,
  loginDisabled: true,
});
