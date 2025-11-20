import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../constants/colors';
import { useI18n } from '../context/I18nContext';

const padNumber = (value) => value.toString().padStart(2, '0');

const parseDateKey = (key) => {
  if (!key) return null;
  const [year, month, day] = key.split('-').map(Number);
  if ([year, month, day].some((part) => Number.isNaN(part))) {
    return null;
  }
  return new Date(year, month - 1, day);
};

const buildItems = (dates, locale) => {
  const unique = Array.from(new Set(dates.filter(Boolean)));
  const sorted = unique.sort();

  // Resolve locale to proper format
  const resolvedLocale = locale === 'tr' ? 'tr-TR' : locale === 'en' ? 'en-US' : locale || 'en-US';

  return sorted.map((key) => {
    const dateInstance = parseDateKey(key);
    if (!dateInstance) {
      return null;
    }

    const dayLabel = dateInstance
      .toLocaleDateString(resolvedLocale, { weekday: 'short' })
      .toUpperCase();

    return {
      key,
      value: key,
      dayLabel,
      dateNumber: padNumber(dateInstance.getDate()),
      isWeekend: [0, 6].includes(dateInstance.getDay()),
    };
  }).filter(Boolean);
};

export default function DateCarouselPicker({
  dates = [],
  selectedDate = null,
  onSelectDate,
  allowClear = false,
  allLabel = 'All',
  theme = 'light',
}) {
  const { language } = useI18n();

  const items = useMemo(() => {
    const baseItems = buildItems(dates, language);

    if (allowClear) {
      return [
        {
          key: 'all',
          value: null,
          dayLabel: allLabel.toUpperCase(),
          dateNumber: '',
          isWeekend: false,
          isAll: true,
        },
        ...baseItems,
      ];
    }

    return baseItems;
  }, [dates, allowClear, allLabel, language]);

  if (!items.length) {
    return null;
  }

  const containerGradient =
    theme === 'dark'
      ? ['#1F2230', '#111927']
      : [colors.white, '#F7F9F7'];

  return (
    <LinearGradient
      colors={containerGradient}
      style={[
        styles.container,
        theme === 'dark' ? styles.containerDark : styles.containerLight,
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {items.map((item) => {
          const isSelected = selectedDate === item.value;
          const pillGradient = isSelected
            ? [colors.primary, colors.primaryDark]
            : ['rgba(255,255,255,0.7)', 'rgba(255,255,255,0.7)'];

          const dayColor = (() => {
            if (item.isAll) {
              return isSelected ? colors.white : colors.textSecondary;
            }
            if (isSelected) {
              return colors.white;
            }
            if (item.isWeekend) {
              return colors.error;
            }
            return colors.textSecondary;
          })();

          const dateColor = isSelected ? colors.white : colors.textPrimary;

          return (
            <TouchableOpacity
              key={item.key}
              activeOpacity={0.8}
              style={styles.pillWrapper}
              onPress={() => onSelectDate && onSelectDate(item.value)}
            >
              <LinearGradient
                colors={pillGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                  styles.pill,
                  isSelected ? styles.pillSelected : styles.pillUnselected,
                  theme === 'dark' && !isSelected && styles.pillDark,
                ]}
              >
                <Text style={[styles.dayText, { color: dayColor }]}>
                  {item.dayLabel}
                </Text>
                {!item.isAll && (
                  <Text style={[styles.dateText, { color: dateColor }]}>
                    {item.dateNumber}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 16,
    ...colors.shadow,
  },
  containerLight: {
    borderWidth: 1,
    borderColor: 'rgba(107, 127, 106, 0.08)',
  },
  containerDark: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  scrollContent: {
    paddingHorizontal: 6,
  },
  pillWrapper: {
    marginHorizontal: 4,
  },
  pill: {
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minWidth: 72,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillSelected: {
    shadowColor: colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  pillUnselected: {
    borderWidth: 1,
    borderColor: 'rgba(107, 127, 106, 0.08)',
  },
  pillDark: {
    backgroundColor: 'rgba(17, 25, 39, 0.9)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  dayText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  dateText: {
    fontSize: 18,
    fontWeight: '700',
  },
});
