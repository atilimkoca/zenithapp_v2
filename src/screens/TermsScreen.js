import React from 'react';
import { StyleSheet, View, ScrollView, Text } from 'react-native';
import UniqueHeader from '../components/UniqueHeader';
import { colors } from '../constants/colors';
import { useI18n } from '../context/I18nContext';

export default function TermsScreen({ navigation }) {
  const { t } = useI18n();

  const termParagraphs = [
    t('legal.termsIntro'),
    t('legal.termsUsage'),
    t('legal.termsBookings'),
    t('legal.termsPayments'),
    t('legal.contactNote'),
  ];

  return (
    <View style={styles.container}>
      <UniqueHeader
        title={t('legal.termsTitle')}
        subtitle={t('legal.termsSubtitle')}
        leftIcon="arrow-back"
        onLeftPress={() => navigation.goBack()}
        showNotification={false}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {termParagraphs.map((paragraph, index) => (
          <Text key={index} style={styles.paragraph}>
            {paragraph}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    gap: 16,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },
});
