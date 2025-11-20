import React from 'react';
import { StyleSheet, View, ScrollView, Text } from 'react-native';
import UniqueHeader from '../components/UniqueHeader';
import { colors } from '../constants/colors';
import { useI18n } from '../context/I18nContext';

export default function PrivacyScreen({ navigation }) {
  const { t } = useI18n();

  const privacyParagraphs = [
    t('legal.privacyIntro'),
    t('legal.privacyData'),
    t('legal.privacyUsage'),
    t('legal.privacySecurity'),
    t('legal.privacyRights'),
    t('legal.contactNote'),
  ];

  return (
    <View style={styles.container}>
      <UniqueHeader
        title={t('legal.privacyTitle')}
        subtitle={t('legal.privacySubtitle')}
        leftIcon="arrow-back"
        onLeftPress={() => navigation.goBack()}
        showNotification={false}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {privacyParagraphs.map((paragraph, index) => (
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
