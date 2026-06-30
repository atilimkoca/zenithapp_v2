import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import PushNotificationSender from './pushNotificationSender';
import {
  RULE_TYPES,
  DEFAULT_RULES,
  SAMPLE_VARS,
  renderTemplate,
  validateTemplate,
} from '../constants/notificationRules';

const COLLECTION = 'notificationRules';

/**
 * Service for managing automatic notification rules (mobile admin).
 * Reads/writes the Firestore `notificationRules` collection — the same data the
 * web admin and Cloud Functions use. Missing rules fall back to DEFAULT_RULES.
 */
export const notificationRulesService = {
  // Fetch all 4 rules, merging stored values over defaults.
  getRules: async () => {
    try {
      const snapshot = await getDocs(collection(db, COLLECTION));
      const stored = {};
      snapshot.forEach((d) => {
        stored[d.id] = d.data();
      });
      const rules = Object.keys(DEFAULT_RULES).map((type) => ({
        ...DEFAULT_RULES[type],
        ...(stored[type] || {}),
        ruleType: type,
      }));
      return { success: true, rules };
    } catch (error) {
      console.error('❌ Error getting notification rules:', error);
      return { success: false, error: error.code, rules: [] };
    }
  },

  getRule: async (ruleType) => {
    try {
      const snap = await getDoc(doc(db, COLLECTION, ruleType));
      const base = DEFAULT_RULES[ruleType] || { ruleType };
      return { success: true, rule: { ...base, ...(snap.exists() ? snap.data() : {}), ruleType } };
    } catch (error) {
      console.error('❌ Error getting notification rule:', error);
      return { success: false, error: error.code, rule: DEFAULT_RULES[ruleType] };
    }
  },

  // Persist a rule (merge). `updatedBy` should be the admin uid.
  updateRule: async (ruleType, data, updatedBy) => {
    try {
      const payload = {
        ...data,
        ruleType,
        updatedAt: new Date().toISOString(),
        ...(updatedBy && { updatedBy }),
      };
      await setDoc(doc(db, COLLECTION, ruleType), payload, { merge: true });
      return { success: true };
    } catch (error) {
      console.error('❌ Error updating notification rule:', error);
      return { success: false, error: error.code, message: 'Kural kaydedilemedi.' };
    }
  },

  toggleRule: async (ruleType, enabled, updatedBy) => {
    return notificationRulesService.updateRule(ruleType, { enabled }, updatedBy);
  },

  // Send a test notification of this rule to the current admin's own device,
  // with sample variable values filled in. Never reaches real users.
  sendTest: async (rule, adminUserId, lang = 'tr', useCancelTemplate = false) => {
    try {
      const template = useCancelTemplate && rule.cancelTemplate ? rule.cancelTemplate : rule.template;
      const { title, body } = renderTemplate(template, lang, SAMPLE_VARS);
      const result = await PushNotificationSender.sendPushToUser(adminUserId, {
        title: `[TEST] ${title}`,
        message: body,
        type: rule.ruleType,
      });
      return { success: !!result?.success, result };
    } catch (error) {
      console.error('❌ Error sending test notification:', error);
      return { success: false, error: error.message };
    }
  },

  validateTemplate,
  RULE_TYPES,
};

export default notificationRulesService;
