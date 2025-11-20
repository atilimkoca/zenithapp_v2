const FALLBACK_TRANSLATE = (key, fallback) => fallback || key;

const mapRelative = (value, t) => {
  if (!value) {
    return null;
  }

  const fallbacks = {
    today: 'Today',
    tomorrow: 'Tomorrow',
    yesterday: 'Yesterday',
  };

  return t('time.' + value, fallbacks[value] || value);
};

const toDate = (input) => {
  if (!input && input !== 0) {
    return null;
  }

  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input;
  }

  if (typeof input === 'string' || typeof input === 'number') {
    const normalized = new Date(input);
    return Number.isNaN(normalized.getTime()) ? null : normalized;
  }

  if (typeof input === 'object') {
    if (input === null) {
      return null;
    }

    if (typeof input.type === 'string') {
      if (input.type === 'relative' || input.type === 'error') {
        return input;
      }
    }

    if (input.date) {
      return toDate(input.date);
    }

    if (input.value) {
      return toDate(input.value);
    }

    if (typeof input.seconds === 'number') {
      const millis = input.seconds * 1000 + (input.nanoseconds ? input.nanoseconds / 1_000_000 : 0);
      const normalized = new Date(millis);
      return Number.isNaN(normalized.getTime()) ? null : normalized;
    }

    if (typeof input.toDate === 'function') {
      const normalized = input.toDate();
      return normalized instanceof Date && !Number.isNaN(normalized.getTime()) ? normalized : null;
    }
  }

  return null;
};

const resolveLocale = (locale) => {
  if (!locale) {
    return 'en-US';
  }

  if (locale.includes('-')) {
    return locale;
  }

  switch (locale) {
    case 'tr':
      return 'tr-TR';
    case 'en':
      return 'en-US';
    default:
      return locale;
  }
};

export const formatLocalizedDate = (dateInput, locale = 'en', t = FALLBACK_TRANSLATE) => {
  if (dateInput === null || dateInput === undefined || dateInput === '') {
    return t('time.dateNotSpecified', 'Date not specified');
  }

  if (typeof dateInput === 'object' && dateInput !== null && typeof dateInput.type === 'string') {
    if (dateInput.type === 'relative') {
      return mapRelative(dateInput.value, t) || t('time.dateNotSpecified', 'Date not specified');
    }

    if (dateInput.type === 'error') {
      if (dateInput.value === 'no_date') {
        return t('time.dateNotSpecified', 'Date not specified');
      }
      return t('time.dateError', 'Date error');
    }
  }

  const date = toDate(dateInput);

  if (!date) {
    return t('time.invalidDate', 'Invalid date');
  }

  const normalizedTarget = resolveLocale(locale);

  try {
    return date.toLocaleDateString(normalizedTarget, {
      day: 'numeric',
      month: 'long',
      weekday: 'long',
    });
  } catch (error) {
    try {
      return date.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'long',
        weekday: 'long',
      });
    } catch (fallbackError) {
      return date.toDateString();
    }
  }
};
