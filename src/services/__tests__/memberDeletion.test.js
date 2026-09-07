import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildDeletionPayload, DELETION_REASON } from '../memberDeletion.js';

const NOW = new Date(2026, 8, 8, 14, 30, 0);
const memberData = { firstName: 'Mine', lastName: 'Gür', status: 'approved', membershipStatus: 'active', remainingClasses: 2 };
const build = (over = {}) => buildDeletionPayload({
  memberData, deletedBy: 'admin-uid-1', deletedByName: 'Gizem Topuz', deletedFrom: 'web', now: NOW, ...over,
});

describe('buildDeletionPayload', () => {
  test('marks the member deleted without destroying the document', () => {
    const p = build();
    assert.equal(p.status, 'permanently_deleted');
    assert.equal(p.membershipStatus, 'deleted');
    assert.equal(p.loginDisabled, true);
    assert.equal(p.deletionReason, DELETION_REASON);
    assert.equal(p.deletedAt, NOW.toISOString());
  });

  test('records who deleted the member, by id and by name', () => {
    const p = build();
    assert.equal(p.deletedBy, 'admin-uid-1');
    assert.equal(p.deletedByName, 'Gizem Topuz');
  });

  test('records which panel the deletion came from', () => {
    assert.equal(build().deletedFrom, 'web');
    assert.equal(build({ deletedFrom: 'mobile' }).deletedFrom, 'mobile');
  });

  test('falls back to the legacy "admin" marker when the id is unknown', () => {
    const p = build({ deletedBy: null, deletedByName: null });
    assert.equal(p.deletedBy, 'admin');
    assert.equal(p.deletedByName, null);
  });

  test('keeps a snapshot of the member for restoring later', () => {
    assert.deepEqual(build().originalData, memberData);
  });

  test('leaves updatedAt to the caller, since each app stamps it differently', () => {
    assert.equal('updatedAt' in build(), false);
  });
});
