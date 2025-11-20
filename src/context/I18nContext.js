import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import enTranslations from '../locales/en';
import trTranslations from '../locales/tr';

const I18nContext = createContext();

export const I18nProvider = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [isLoading, setIsLoading] = useState(true);

  const allTranslations = {
    en: enTranslations,
    tr: trTranslations
  };

  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const savedLanguage = await AsyncStorage.getItem('language');
        if (savedLanguage && ['en', 'tr'].includes(savedLanguage)) {
          setCurrentLanguage(savedLanguage);
        }
      } catch (error) {
        console.error('Error loading language:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadLanguage();
  }, []);

  const changeLanguage = async (newLanguage) => {
    try {
      await AsyncStorage.setItem('language', newLanguage);
      setCurrentLanguage(newLanguage);
    } catch (error) {
      console.error('Error saving language:', error);
    }
  };

  const getAvailableLanguages = () => {
    return [
      { code: 'en', name: 'English', flag: '🇺🇸' },
      { code: 'tr', name: 'Türkçe', flag: '🇹🇷' }
    ];
  };

  const translate = (key) => {
    if (isLoading) {
      return key;
    }

    const currentTranslations = allTranslations[currentLanguage];
    
    if (!currentTranslations) {
      console.warn('I18n: No translations found for language:', currentLanguage);
      return key;
    }

    const keys = key.split('.');
    let value = currentTranslations;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        console.warn('I18n: Key not found:', key, 'Current language:', currentLanguage, 'Available keys at this level:', value ? Object.keys(value) : 'none');
        if (key.startsWith('auth.')) {
          console.log('I18n: Full auth object:', allTranslations[currentLanguage]?.auth);
        }
        return key;
      }
    }

    return typeof value === 'string' ? value : key;
  };

  const value = {
    currentLanguage,
    changeLanguage,
    getAvailableLanguages,
    translate,
    isLoading,
    t: translate, // Alias for convenience
    language: currentLanguage, // Add language alias for compatibility
    locale: currentLanguage // Add locale alias for compatibility
  };

  console.log('I18n: Context value:', { currentLanguage, isLoading });
  
  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};
