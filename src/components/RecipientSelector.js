import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { resolveRecipients } from '../utils/recipientResolver';

// Section-local palette, aligned with the automatic-notifications screens.
const T = {
  sage: '#5A6B5B',
  sageDark: '#3F4D40',
  sageSoft: '#E7ECE4',
  clay: '#C08552',
  claySoft: '#F1E4D6',
  canvas: '#F6F4EE',
  card: '#FFFEFB',
  ink: '#26312A',
  muted: '#7C857C',
  line: '#E7E3D8',
};

const TABS = [
  { key: 'all', label: 'Herkes', icon: 'people' },
  { key: 'segment', label: 'Segment', icon: 'options' },
  { key: 'individuals', label: 'Kişi seç', icon: 'person-add' },
];

const STATUS_FILTERS = [
  { key: 'active', label: 'Aktif' },
  { key: 'pending', label: 'Onay bekleyen' },
  { key: 'passive', label: 'Pasif' },
];
const PACKAGE_FILTERS = [
  { key: 'group', label: 'Grup dersi' },
  { key: 'one-on-one', label: 'Birebir' },
];
const ROLE_FILTERS = [
  { key: 'member', label: 'Üye' },
  { key: 'trainer', label: 'Eğitmen' },
  { key: 'admin', label: 'Yönetici' },
];

const STATUS_LABEL = { active: 'Aktif', pending: 'Onayda', passive: 'Pasif' };

function userName(u) {
  return (
    u.displayName ||
    [u.firstName, u.lastName].filter(Boolean).join(' ') ||
    u.email ||
    'İsimsiz'
  );
}

/**
 * Recipient selector for manual notifications.
 * Controlled component: `spec` is the targeting spec, `onChange(spec)` updates it.
 * Shows a live "X kişiye gidecek" count derived from `audience`.
 */
export default function RecipientSelector({ audience = [], spec, onChange }) {
  const mode = spec?.mode || 'all';
  const filters = spec?.filters || {};
  const selectedIds = spec?.userIds || [];
  const [search, setSearch] = useState('');

  const resolved = useMemo(() => resolveRecipients(spec, audience), [spec, audience]);

  const setMode = (m) => {
    if (m === 'all') onChange({ mode: 'all' });
    else if (m === 'segment') onChange({ mode: 'segment', filters: filters });
    else onChange({ mode: 'individuals', userIds: selectedIds });
  };

  const toggleFilter = (group, key) => {
    const next = { ...filters };
    if (next[group] === key) delete next[group];
    else next[group] = key;
    onChange({ mode: 'segment', filters: next });
  };

  const toggleUser = (id) => {
    const set = new Set(selectedIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange({ mode: 'individuals', userIds: Array.from(set) });
  };

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = audience.filter((u) => (u.status !== 'deleted' && u.status !== 'permanently_deleted'));
    if (!q) return list.slice(0, 60);
    return list
      .filter((u) => userName(u).toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q))
      .slice(0, 60);
  }, [audience, search]);

  return (
    <View>
      {/* Segmented tabs */}
      <View style={styles.tabs}>
        {TABS.map((t) => {
          const active = mode === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setMode(t.key)}
              activeOpacity={0.8}
            >
              <Ionicons name={t.icon} size={15} color={active ? '#fff' : T.muted} />
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Mode content */}
      {mode === 'all' && (
        <Text style={styles.hint}>Tüm kayıtlı üyelere gönderilir.</Text>
      )}

      {mode === 'segment' && (
        <View style={styles.segmentBox}>
          <FilterRow label="Üyelik durumu" options={STATUS_FILTERS} selected={filters.status} onPick={(k) => toggleFilter('status', k)} />
          <FilterRow label="Paket tipi" options={PACKAGE_FILTERS} selected={filters.packageType} onPick={(k) => toggleFilter('packageType', k)} />
          <FilterRow label="Rol" options={ROLE_FILTERS} selected={filters.role} onPick={(k) => toggleFilter('role', k)} />
          <Text style={styles.andNote}>Seçilen filtreler birlikte (VE) uygulanır.</Text>
        </View>
      )}

      {mode === 'individuals' && (
        <View style={styles.segmentBox}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={T.muted} />
            <TextInput
              style={styles.searchInput}
              placeholder="İsim veya e-posta ara…"
              placeholderTextColor="#AAB0A8"
              value={search}
              onChangeText={setSearch}
            />
            {selectedIds.length > 0 && (
              <View style={styles.selCount}>
                <Text style={styles.selCountText}>{selectedIds.length}</Text>
              </View>
            )}
          </View>
          <ScrollView style={styles.userList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {filteredUsers.map((u) => {
              const checked = selectedIds.includes(u.id);
              const cls = u._class || {};
              const badge = cls.role === 'trainer' ? 'Eğitmen' : cls.role === 'admin' ? 'Yönetici' : STATUS_LABEL[cls.status] || '—';
              return (
                <TouchableOpacity key={u.id} style={styles.userRow} onPress={() => toggleUser(u.id)} activeOpacity={0.7}>
                  <View style={[styles.avatar, checked && styles.avatarOn]}>
                    <Text style={[styles.avatarText, checked && { color: '#fff' }]}>
                      {userName(u).charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userName} numberOfLines={1}>{userName(u)}</Text>
                    <Text style={styles.userMail} numberOfLines={1}>{u.email || '—'}</Text>
                  </View>
                  <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View>
                  <Ionicons
                    name={checked ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={checked ? T.sage : T.line}
                  />
                </TouchableOpacity>
              );
            })}
            {filteredUsers.length === 0 && <Text style={styles.empty}>Sonuç yok.</Text>}
          </ScrollView>
        </View>
      )}

      {/* Live count */}
      <View style={[styles.countBar, resolved.count === 0 && styles.countBarEmpty]}>
        <Ionicons name="send" size={15} color={resolved.count === 0 ? T.muted : T.sage} />
        <Text style={[styles.countText, resolved.count === 0 && { color: T.muted }]}>
          {resolved.count === 0
            ? 'Bu kritere uyan kullanıcı yok'
            : <>Bu bildirim <Text style={styles.countNum}>{resolved.count}</Text> kişiye gidecek</>}
        </Text>
      </View>
    </View>
  );
}

function FilterRow({ label, options, selected, onPick }) {
  return (
    <View style={styles.filterRow}>
      <Text style={styles.filterLabel}>{label}</Text>
      <View style={styles.chipWrap}>
        {options.map((o) => {
          const active = selected === o.key;
          return (
            <TouchableOpacity key={o.key} style={[styles.chip, active && styles.chipActive]} onPress={() => onPick(o.key)}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', backgroundColor: T.sageSoft, borderRadius: 14, padding: 4, gap: 4 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 10 },
  tabActive: { backgroundColor: T.sage },
  tabText: { fontSize: 13, fontWeight: '700', color: T.muted },
  tabTextActive: { color: '#fff' },

  hint: { marginTop: 12, color: T.muted, fontSize: 13 },

  segmentBox: { marginTop: 14, backgroundColor: T.canvas, borderRadius: 14, borderWidth: 1, borderColor: T.line, padding: 14 },
  filterRow: { marginBottom: 14 },
  filterLabel: { fontSize: 12.5, fontWeight: '700', color: T.sageDark, marginBottom: 8 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: T.line, backgroundColor: '#fff' },
  chipActive: { backgroundColor: T.sage, borderColor: T.sage },
  chipText: { color: T.muted, fontWeight: '600', fontSize: 12.5 },
  chipTextActive: { color: '#fff' },
  andNote: { fontSize: 11.5, color: T.muted, fontStyle: 'italic', marginTop: 2 },

  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: T.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  searchInput: { flex: 1, fontSize: 14, color: T.ink, padding: 0 },
  selCount: { backgroundColor: T.sage, borderRadius: 999, minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  selCountText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  userList: { maxHeight: 240, marginTop: 10 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: T.claySoft, alignItems: 'center', justifyContent: 'center' },
  avatarOn: { backgroundColor: T.sage },
  avatarText: { fontWeight: '800', color: T.clay, fontSize: 15 },
  userName: { fontSize: 14, fontWeight: '600', color: T.ink },
  userMail: { fontSize: 12, color: T.muted },
  badge: { backgroundColor: T.sageSoft, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  badgeText: { fontSize: 10.5, fontWeight: '700', color: T.sageDark },
  empty: { color: T.muted, fontSize: 13, paddingVertical: 16, textAlign: 'center' },

  countBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, backgroundColor: T.sageSoft, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  countBarEmpty: { backgroundColor: '#F0EFE9' },
  countText: { fontSize: 13.5, color: T.sageDark, fontWeight: '600' },
  countNum: { fontWeight: '800', color: T.sage },
});
