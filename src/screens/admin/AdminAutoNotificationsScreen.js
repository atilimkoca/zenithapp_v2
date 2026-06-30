import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import UniqueHeader from '../../components/UniqueHeader';
import { notificationRulesService } from '../../services/notificationRulesService';
import {
  RULE_TYPES,
  RULE_META,
  TEMPLATE_VARIABLES,
  SAMPLE_VARS,
  renderTemplate,
  validateTemplate,
} from '../../constants/notificationRules';

// Section-local brand palette (sage + warm clay), aligned with the web screen.
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

const PRIORITIES = [
  { key: 'low', label: 'Düşük' },
  { key: 'normal', label: 'Normal' },
  { key: 'high', label: 'Yüksek' },
  { key: 'urgent', label: 'Acil' },
];

const EVENT_NODE = {
  [RULE_TYPES.LESSON_REMINDER]: 'Ders',
  [RULE_TYPES.MEMBERSHIP_EXPIRING]: 'Bitiş',
};

function TimingRail({ rule, meta }) {
  if (meta.category !== 'scheduled') {
    const text =
      rule.ruleType === RULE_TYPES.CREDIT_LOW
        ? `Kalan ders ≤ ${rule.threshold ?? '–'} olunca`
        : 'Kayıt ve iptal anında';
    return (
      <View style={styles.signal}>
        <View style={styles.pulse} />
        <Text style={styles.signalText}>{text}</Text>
      </View>
    );
  }
  const unit = meta.settingUnit === 'saat' ? 's' : 'g';
  const offsets = [...(rule[meta.setting] || [])].sort((a, b) => b - a);
  return (
    <View style={styles.rail}>
      {offsets.length === 0 ? (
        <Text style={styles.railEmpty}>Zamanlama seçilmedi</Text>
      ) : (
        offsets.map((o) => (
          <View key={o} style={styles.railNode}>
            <View style={styles.railDot} />
            <Text style={styles.railNodeText}>{o}{unit}</Text>
          </View>
        ))
      )}
      <View style={styles.railLine} />
      <View style={styles.railEvent}>
        <Text style={styles.railEventText}>{EVENT_NODE[rule.ruleType]}</Text>
      </View>
    </View>
  );
}

export default function AdminAutoNotificationsScreen({ navigation }) {
  const { user } = useAuth();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [previewCancel, setPreviewCancel] = useState(false);

  const loadRules = async () => {
    setLoading(true);
    const res = await notificationRulesService.getRules();
    if (res.success) setRules(res.rules);
    setLoading(false);
  };

  useEffect(() => {
    loadRules();
  }, []);

  const handleToggle = async (rule, value) => {
    setRules((prev) => prev.map((r) => (r.ruleType === rule.ruleType ? { ...r, enabled: value } : r)));
    const res = await notificationRulesService.toggleRule(rule.ruleType, value, user?.uid);
    if (!res.success) {
      Alert.alert('Hata', 'Durum güncellenemedi.');
      loadRules();
    }
  };

  const openEdit = (rule) => {
    setPreviewCancel(false);
    setEditing(JSON.parse(JSON.stringify(rule)));
  };

  const updateDraft = (patch) => setEditing((d) => ({ ...d, ...patch }));

  const updateTemplate = (which, lang, field, value) => {
    setEditing((d) => ({
      ...d,
      [which]: { ...d[which], [lang]: { ...(d[which]?.[lang] || {}), [field]: value } },
    }));
  };

  const toggleOffset = (settingKey, option) => {
    setEditing((d) => {
      const current = Array.isArray(d[settingKey]) ? d[settingKey] : [];
      const next = current.includes(option)
        ? current.filter((o) => o !== option)
        : [...current, option].sort((a, b) => b - a);
      return { ...d, [settingKey]: next };
    });
  };

  const handleSave = () => {
    const meta = RULE_META[editing.ruleType];
    const validation = validateTemplate(editing.template);
    if (!validation.valid) {
      Alert.alert(
        'Bilinmeyen değişken',
        `Şablonda tanımsız değişken var: ${validation.unknownVariables.map((v) => `{${v}}`).join(', ')}. Yine de kaydedilsin mi?`,
        [
          { text: 'Vazgeç', style: 'cancel' },
          { text: 'Kaydet', onPress: doSave },
        ]
      );
      return;
    }
    if (meta.setting && Array.isArray(editing[meta.setting]) && editing[meta.setting].length === 0 && editing.enabled) {
      Alert.alert('Eksik ayar', `En az bir ${meta.settingUnit} değeri seçmelisin.`);
      return;
    }
    doSave();
  };

  const doSave = async () => {
    setSaving(true);
    const res = await notificationRulesService.updateRule(editing.ruleType, editing, user?.uid);
    setSaving(false);
    if (res.success) {
      setRules((prev) => prev.map((r) => (r.ruleType === editing.ruleType ? editing : r)));
      setEditing(null);
    } else {
      Alert.alert('Hata', res.message || 'Kaydedilemedi.');
    }
  };

  const handleTest = async () => {
    if (!user?.uid) return;
    const res = await notificationRulesService.sendTest(editing, user.uid, 'tr', previewCancel);
    Alert.alert(
      res.success ? 'Test gönderildi' : 'Test başarısız',
      res.success ? 'Test bildirimi kendi cihazına gönderildi.' : 'Gönderilemedi. Bildirim iznin açık mı?'
    );
  };

  const activeCount = rules.filter((r) => r.enabled).length;
  const meta = editing ? RULE_META[editing.ruleType] : null;
  const previewTemplate = editing
    ? previewCancel && editing.cancelTemplate
      ? editing.cancelTemplate
      : editing.template
    : null;
  const preview = previewTemplate ? renderTemplate(previewTemplate, 'tr', SAMPLE_VARS) : null;

  const renderTemplateEditor = (label, lang, which) => {
    const variant = editing[which]?.[lang] || { title: '', body: '' };
    return (
      <View style={styles.field} key={`${which}-${lang}`}>
        <Text style={styles.flag}>{lang === 'tr' ? '🇹🇷' : '🇬🇧'}  {label}</Text>
        <TextInput
          style={styles.input}
          placeholder="Başlık"
          placeholderTextColor="#AAB0A8"
          value={variant.title}
          onChangeText={(t) => updateTemplate(which, lang, 'title', t)}
        />
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          placeholder="Mesaj"
          placeholderTextColor="#AAB0A8"
          multiline
          value={variant.body}
          onChangeText={(t) => updateTemplate(which, lang, 'body', t)}
        />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <UniqueHeader
        title="Otomatik Bildirimler"
        subtitle="Stüdyo kendi kendine konuşsun"
        leftIcon="arrow-back"
        onLeftPress={() => navigation.goBack()}
        showNotification={false}
        showStats={!loading}
        stats={[
          { value: String(activeCount), label: 'Aktif', icon: 'flash-outline', color: 'rgba(255,255,255,0.3)' },
          { value: String(rules.length || 4), label: 'Toplam', icon: 'layers-outline', color: 'rgba(255,255,255,0.3)' },
        ]}
      />

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={T.sage} />
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {rules.map((rule) => {
            const m = RULE_META[rule.ruleType];
            const on = !!rule.enabled;
            return (
              <View key={rule.ruleType} style={[styles.card, on && styles.cardOn]}>
                {on && <View style={styles.accent} />}
                <View style={styles.cardTop}>
                  <View style={[styles.tag, !on && styles.tagOff]}>
                    <Text style={[styles.tagText, !on && styles.tagTextOff]}>
                      {m.category === 'scheduled' ? 'ZAMANLANMIŞ' : 'ANLIK'}
                    </Text>
                  </View>
                  <Switch
                    value={on}
                    onValueChange={(v) => handleToggle(rule, v)}
                    trackColor={{ false: '#CDD3CB', true: T.sage }}
                    thumbColor="#fff"
                    ios_backgroundColor="#CDD3CB"
                  />
                </View>

                <View style={styles.cardId}>
                  <View style={styles.stone}>
                    <Ionicons name={m.icon} size={22} color={T.sageDark} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{m.label}</Text>
                    <Text style={styles.cardDesc}>{m.description}</Text>
                  </View>
                </View>

                <TimingRail rule={rule} meta={m} />

                <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(rule)}>
                  <Text style={styles.editBtnText}>Düzenle</Text>
                  <Ionicons name="arrow-forward" size={16} color={T.sage} />
                </TouchableOpacity>
              </View>
            );
          })}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}

      {/* Edit modal */}
      <Modal visible={!!editing} animationType="slide" onRequestClose={() => setEditing(null)}>
        {editing && (
          <View style={styles.container}>
            <UniqueHeader
              title={meta.label}
              subtitle={meta.category === 'scheduled' ? 'Zamanlanmış bildirim' : 'Anlık bildirim'}
              leftIcon="close"
              onLeftPress={() => setEditing(null)}
              showNotification={false}
            />
            <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {/* Live notification preview */}
              <View style={styles.previewWrap}>
                <View style={styles.previewBanner}>
                  <View style={styles.previewIcon}>
                    <Text style={styles.previewIconText}>Z</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.previewRow}>
                      <Text style={styles.previewApp}>ZENITH STUDIO</Text>
                      <Text style={styles.previewNow}>şimdi</Text>
                    </View>
                    <Text style={styles.previewTitle}>{preview?.title || 'Başlık'}</Text>
                    <Text style={styles.previewBody}>{preview?.body || 'Mesaj metni'}</Text>
                  </View>
                </View>
                {meta.hasCancelTemplate && (
                  <TouchableOpacity onPress={() => setPreviewCancel((c) => !c)}>
                    <Text style={styles.previewToggle}>
                      {previewCancel ? 'Onay mesajını göster' : 'İptal mesajını göster'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.rowBetween}>
                <Text style={styles.label}>Bu bildirim aktif</Text>
                <Switch
                  value={!!editing.enabled}
                  onValueChange={(v) => updateDraft({ enabled: v })}
                  trackColor={{ false: '#CDD3CB', true: T.sage }}
                  thumbColor="#fff"
                  ios_backgroundColor="#CDD3CB"
                />
              </View>

              {meta.setting && Array.isArray(editing[meta.setting]) && (
                <View style={styles.field}>
                  <Text style={styles.label}>{meta.settingLabel}</Text>
                  <View style={styles.chipWrap}>
                    {meta.settingOptions.map((opt) => {
                      const active = editing[meta.setting].includes(opt);
                      return (
                        <TouchableOpacity
                          key={opt}
                          style={[styles.chip, active && styles.chipActive]}
                          onPress={() => toggleOffset(meta.setting, opt)}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>
                            {opt} {meta.settingUnit}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {meta.setting === 'threshold' && (
                <View style={styles.field}>
                  <Text style={styles.label}>{meta.settingLabel}</Text>
                  <TextInput
                    style={[styles.input, { width: 120 }]}
                    keyboardType="number-pad"
                    value={String(editing.threshold ?? '')}
                    onChangeText={(t) => updateDraft({ threshold: parseInt(t, 10) || 0 })}
                  />
                </View>
              )}

              <View style={styles.field}>
                <Text style={styles.label}>Öncelik</Text>
                <View style={styles.chipWrap}>
                  {PRIORITIES.map((p) => {
                    const active = (editing.priority || 'normal') === p.key;
                    return (
                      <TouchableOpacity
                        key={p.key}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => updateDraft({ priority: p.key })}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{p.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Değişkenler — mesaja ekleyebilirsin</Text>
                <View style={styles.chipWrap}>
                  {TEMPLATE_VARIABLES.map((v) => (
                    <View key={v.key} style={styles.varChip}>
                      <Text style={styles.varChipText}>{`{${v.key}}`}</Text>
                      <Text style={styles.varChipLabel}>{v.label}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>MESAJ</Text>
                <View style={styles.dividerLine} />
              </View>
              {renderTemplateEditor('Türkçe', 'tr', 'template')}
              {renderTemplateEditor('English', 'en', 'template')}

              {meta.hasCancelTemplate && (
                <>
                  <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>İPTAL MESAJI</Text>
                    <View style={styles.dividerLine} />
                  </View>
                  {renderTemplateEditor('Türkçe', 'tr', 'cancelTemplate')}
                  {renderTemplateEditor('English', 'en', 'cancelTemplate')}
                </>
              )}

              <View style={styles.actions}>
                <TouchableOpacity style={styles.testBtn} onPress={handleTest}>
                  <Ionicons name="paper-plane-outline" size={17} color={T.sage} />
                  <Text style={styles.testBtnText}>Test gönder</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Kaydet</Text>}
                </TouchableOpacity>
              </View>
              <View style={{ height: 30 }} />
            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.canvas },
  list: { padding: 16, paddingTop: 18 },

  card: {
    backgroundColor: T.card,
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: T.line,
    overflow: 'hidden',
  },
  cardOn: {
    borderColor: 'rgba(90,107,91,0.32)',
    shadowColor: T.sageDark,
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: T.sage },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tag: { backgroundColor: T.sageSoft, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  tagOff: { backgroundColor: '#EEEDE7' },
  tagText: { fontSize: 10, fontWeight: '700', letterSpacing: 1, color: T.sage },
  tagTextOff: { color: T.muted },

  cardId: { flexDirection: 'row', gap: 14, marginTop: 14, alignItems: 'flex-start' },
  stone: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderBottomLeftRadius: 14,
    backgroundColor: T.claySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: T.ink, marginBottom: 3 },
  cardDesc: { fontSize: 13, color: T.muted, lineHeight: 18 },

  rail: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
    padding: 14,
    backgroundColor: T.canvas,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.line,
    borderStyle: 'dashed',
  },
  railNode: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  railDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: T.sage },
  railNodeText: { fontSize: 13, fontWeight: '700', color: T.sageDark },
  railLine: { flex: 1, minWidth: 16, height: 1, borderTopWidth: 1, borderColor: T.line, borderStyle: 'dashed' },
  railEvent: { backgroundColor: T.clay, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  railEventText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  railEmpty: { fontSize: 13, color: T.muted, fontStyle: 'italic' },

  signal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    padding: 14,
    backgroundColor: T.canvas,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.line,
    borderStyle: 'dashed',
  },
  pulse: { width: 11, height: 11, borderRadius: 6, backgroundColor: T.clay },
  signalText: { fontSize: 13.5, fontWeight: '600', color: T.sageDark, flex: 1 },

  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, alignSelf: 'flex-start' },
  editBtnText: { color: T.sage, fontWeight: '700', fontSize: 14 },

  // Modal form
  form: { padding: 18, paddingTop: 16 },
  previewWrap: { backgroundColor: '#243029', borderRadius: 18, padding: 14, marginBottom: 20 },
  previewBanner: { flexDirection: 'row', gap: 12, backgroundColor: 'rgba(255,255,255,0.97)', borderRadius: 14, padding: 12 },
  previewIcon: {
    width: 38,
    height: 38,
    borderRadius: 9,
    backgroundColor: T.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewIconText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  previewApp: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.5, color: T.muted },
  previewNow: { fontSize: 11, color: T.muted },
  previewTitle: { fontSize: 14.5, fontWeight: '800', color: '#1C241E', marginTop: 2 },
  previewBody: { fontSize: 13, color: '#46504A', lineHeight: 18, marginTop: 1 },
  previewToggle: { color: 'rgba(255,255,255,0.85)', fontSize: 12.5, textAlign: 'center', marginTop: 12, textDecorationLine: 'underline' },

  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  field: { marginTop: 18 },
  label: { fontSize: 14, fontWeight: '700', color: T.ink, marginBottom: 10 },
  flag: { fontSize: 12.5, fontWeight: '600', color: T.muted, marginBottom: 8 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: T.ink,
    marginBottom: 8,
  },
  inputMultiline: { minHeight: 72, textAlignVertical: 'top' },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  chip: {
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: T.line,
    backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: T.sage, borderColor: T.sage },
  chipText: { color: T.muted, fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: '#fff' },

  varChip: { backgroundColor: T.claySoft, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 6 },
  varChipText: { fontWeight: '700', color: T.clay, fontSize: 12.5 },
  varChipLabel: { fontSize: 10, color: '#98775A' },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 24, marginBottom: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: T.line },
  dividerText: { fontSize: 11.5, fontWeight: '800', letterSpacing: 1, color: T.sageDark },

  actions: { marginTop: 24, gap: 12 },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 13,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: T.sage,
    backgroundColor: '#fff',
  },
  testBtnText: { color: T.sage, fontWeight: '700', fontSize: 14.5 },
  saveBtn: { backgroundColor: T.sage, paddingVertical: 15, borderRadius: 13, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
