/**
 * Shared definitions for the automatic (rule-based) notification system.
 *
 * Mirror of the Cloud Functions `functions/lib/ruleDefs.js` + `template.js`.
 * Keep the rule shape, defaults and templating logic in sync across:
 *   - functions/ (server, actually sends)
 *   - zenithapp_v2 (mobile admin, this file)
 *   - zenith_studio_v2 (web admin)
 *
 * Rules live in Firestore `notificationRules`, one doc per ruleType (docId === ruleType).
 */

export const RULE_TYPES = {
  LESSON_REMINDER: 'lesson_reminder',
  MEMBERSHIP_EXPIRING: 'membership_expiring',
  CREDIT_LOW: 'credit_low',
  BOOKING_CONFIRMATION: 'booking_confirmation',
};

// Variables the admin may use in templates. Shown in the editor.
export const TEMPLATE_VARIABLES = [
  { key: 'isim', label: 'Üye adı' },
  { key: 'ders', label: 'Ders türü' },
  { key: 'saat', label: 'Saat' },
  { key: 'tarih', label: 'Tarih' },
  { key: 'kredi', label: 'Kalan kredi' },
];

const VALID_VARS = TEMPLATE_VARIABLES.map((v) => v.key);

// UI metadata for each rule type (label, description, icon, settings shape).
export const RULE_META = {
  [RULE_TYPES.LESSON_REMINDER]: {
    label: 'Ders Hatırlatma',
    description: 'Ders başlamadan önce, yalnızca o derse kayıtlı üyelere.',
    icon: 'alarm-outline',
    color: '#45B7D1',
    setting: 'offsetsHours',
    settingLabel: 'Kaç saat önce',
    settingUnit: 'saat',
    settingOptions: [48, 24, 12, 6, 3, 2, 1],
    category: 'scheduled',
  },
  [RULE_TYPES.MEMBERSHIP_EXPIRING]: {
    label: 'Üyelik Bitiyor',
    description: 'Aktif paketin süresi dolmadan önce.',
    icon: 'time-outline',
    color: '#FF6B6B',
    setting: 'offsetsDays',
    settingLabel: 'Kaç gün önce',
    settingUnit: 'gün',
    settingOptions: [14, 7, 5, 3, 2, 1],
    category: 'scheduled',
  },
  [RULE_TYPES.CREDIT_LOW]: {
    label: 'Kredi Azaldı',
    description: 'Aktif paketin kalan ders hakkı eşiğin altına düşünce.',
    icon: 'trending-down-outline',
    color: '#F39C12',
    setting: 'threshold',
    settingLabel: 'Eşik (kalan ders ≤)',
    settingUnit: 'ders',
    category: 'event',
  },
  [RULE_TYPES.BOOKING_CONFIRMATION]: {
    label: 'Rezervasyon / İptal Onayı',
    description: 'Üye derse kaydolunca veya iptal edince anında.',
    icon: 'checkmark-circle-outline',
    color: '#2ECC71',
    category: 'event',
    hasCancelTemplate: true,
  },
};

export const DEFAULT_RULES = {
  [RULE_TYPES.LESSON_REMINDER]: {
    ruleType: RULE_TYPES.LESSON_REMINDER,
    enabled: false,
    offsetsHours: [24, 2],
    priority: 'high',
    template: {
      tr: { title: 'Ders Hatırlatması', body: "{isim}, {ders} dersin {saat}'da başlıyor." },
      en: { title: 'Class Reminder', body: '{isim}, your {ders} class starts at {saat}.' },
    },
  },
  [RULE_TYPES.MEMBERSHIP_EXPIRING]: {
    ruleType: RULE_TYPES.MEMBERSHIP_EXPIRING,
    enabled: false,
    offsetsDays: [7, 3, 1],
    priority: 'high',
    template: {
      tr: { title: 'Üyeliğin Bitiyor', body: '{isim}, paketinin süresi {tarih} tarihinde doluyor.' },
      en: { title: 'Membership Expiring', body: '{isim}, your package expires on {tarih}.' },
    },
  },
  [RULE_TYPES.CREDIT_LOW]: {
    ruleType: RULE_TYPES.CREDIT_LOW,
    enabled: false,
    threshold: 2,
    priority: 'normal',
    template: {
      tr: { title: 'Kredin Azaldı', body: '{isim}, aktif paketinde {kredi} ders hakkın kaldı.' },
      en: { title: 'Low Credits', body: '{isim}, you have {kredi} classes left in your active package.' },
    },
  },
  [RULE_TYPES.BOOKING_CONFIRMATION]: {
    ruleType: RULE_TYPES.BOOKING_CONFIRMATION,
    enabled: false,
    priority: 'normal',
    template: {
      tr: { title: 'Rezervasyon Onayı', body: '{isim}, {tarih} {saat} {ders} dersine kaydın alındı.' },
      en: { title: 'Booking Confirmed', body: '{isim}, you are booked for {ders} on {tarih} at {saat}.' },
    },
    cancelTemplate: {
      tr: { title: 'Rezervasyon İptali', body: '{isim}, {tarih} {saat} {ders} dersi rezervasyonun iptal edildi.' },
      en: { title: 'Booking Cancelled', body: '{isim}, your booking for {ders} on {tarih} at {saat} was cancelled.' },
    },
  },
};

// Sample variable values for the "Test gönder" preview.
export const SAMPLE_VARS = {
  isim: 'Test',
  ders: 'Yoga',
  saat: '18:00',
  tarih: '01.07.2026',
  kredi: 3,
};

const PLACEHOLDER_RE = /\{(\w+)\}/g;

function fillString(str, vars) {
  if (!str) return '';
  return str.replace(PLACEHOLDER_RE, (m, key) => {
    const v = vars[key];
    return v === undefined || v === null ? '' : String(v);
  });
}

export function renderTemplate(template, lang, vars = {}) {
  const normalized = (lang || 'tr').toString().toLowerCase().slice(0, 2);
  const variant = (template && (template[normalized] || template.tr || template.en)) || { title: '', body: '' };
  return { title: fillString(variant.title, vars), body: fillString(variant.body, vars) };
}

export function validateTemplate(template) {
  const unknown = new Set();
  ['tr', 'en'].forEach((lang) => {
    const variant = (template && template[lang]) || {};
    [variant.title, variant.body].forEach((str) => {
      if (!str) return;
      let m;
      PLACEHOLDER_RE.lastIndex = 0;
      while ((m = PLACEHOLDER_RE.exec(str)) !== null) {
        if (!VALID_VARS.includes(m[1])) unknown.add(m[1]);
      }
    });
  });
  return { valid: unknown.size === 0, unknownVariables: Array.from(unknown) };
}
