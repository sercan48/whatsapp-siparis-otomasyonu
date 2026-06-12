/**
 * i18n Provider - Multi-Language Support
 * Supports: Turkish (TR), English (EN), Russian (RU), German (DE), Arabic (AR)
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

// Import translations
import tr from './i18n/tr.json';
import en from './i18n/en.json';
import ru from './i18n/ru.json';
import de from './i18n/de.json';
import ar from './i18n/ar.json';

const translations = { tr, en, ru, de, ar };

const LANGUAGES = [
    { code: 'tr', name: 'Türkçe', flag: '🇹🇷', dir: 'ltr' },
    { code: 'en', name: 'English', flag: '🇬🇧', dir: 'ltr' },
    { code: 'ru', name: 'Русский', flag: '🇷🇺', dir: 'ltr' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪', dir: 'ltr' },
    { code: 'ar', name: 'العربية', flag: '🇸🇦', dir: 'rtl' }
];

const I18nContext = createContext(null);

export const I18nProvider = ({ children }) => {
    const [locale, setLocale] = useState(() => {
        // Get from localStorage or default to Turkish
        return localStorage.getItem('app_language') || 'tr';
    });

    const [direction, setDirection] = useState('ltr');

    useEffect(() => {
        // Save to localStorage
        localStorage.setItem('app_language', locale);

        // Update document direction for RTL languages
        const langConfig = LANGUAGES.find(l => l.code === locale);
        const dir = langConfig?.dir || 'ltr';
        setDirection(dir);
        document.documentElement.dir = dir;
        document.documentElement.lang = locale;
    }, [locale]);

    // Translation function
    const t = (key, params = {}) => {
        const keys = key.split('.');
        let value = translations[locale];

        for (const k of keys) {
            value = value?.[k];
            if (value === undefined) break;
        }

        // Fallback to Turkish if not found
        if (value === undefined) {
            value = translations['tr'];
            for (const k of keys) {
                value = value?.[k];
                if (value === undefined) break;
            }
        }

        // If still not found, return the key
        if (value === undefined) return key;

        // Replace parameters like {name}
        if (typeof value === 'string' && Object.keys(params).length > 0) {
            Object.entries(params).forEach(([paramKey, paramValue]) => {
                value = value.replace(new RegExp(`{${paramKey}}`, 'g'), paramValue);
            });
        }

        return value;
    };

    // Change language
    const changeLanguage = (langCode) => {
        if (translations[langCode]) {
            setLocale(langCode);
        }
    };

    // Get current language info
    const getCurrentLanguage = () => {
        return LANGUAGES.find(l => l.code === locale) || LANGUAGES[0];
    };

    // Get all available languages
    const getLanguages = () => LANGUAGES;

    const value = {
        locale,
        direction,
        t,
        changeLanguage,
        getCurrentLanguage,
        getLanguages
    };

    return (
        <I18nContext.Provider value={value}>
            {children}
        </I18nContext.Provider>
    );
};

// Hook to use translations
export const useTranslation = () => {
    const context = useContext(I18nContext);
    if (!context) {
        throw new Error('useTranslation must be used within I18nProvider');
    }
    return context;
};

// Higher-order component for class components
export const withTranslation = (Component) => {
    return function WrappedComponent(props) {
        const i18n = useTranslation();
        return <Component {...props} t={i18n.t} locale={i18n.locale} />;
    };
};

export default I18nProvider;
