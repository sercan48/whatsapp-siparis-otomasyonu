import React, { useState, useRef, useEffect } from 'react';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { useTranslation } from '../lib/i18nProvider';

export const LanguageSelector = ({ variant = 'dropdown' }) => {
    const { locale, changeLanguage, getCurrentLanguage, getLanguages } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    const languages = getLanguages();
    const currentLang = getCurrentLanguage();

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (variant === 'pills') {
        return (
            <div className="flex gap-1 flex-wrap">
                {languages.map(lang => (
                    <button
                        key={lang.code}
                        onClick={() => changeLanguage(lang.code)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${locale === lang.code
                                ? 'bg-blue-500 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                    >
                        <span className="mr-1">{lang.flag}</span>
                        {lang.code.toUpperCase()}
                    </button>
                ))}
            </div>
        );
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 
                           transition-colors text-slate-700"
            >
                <span className="text-lg">{currentLang.flag}</span>
                <span className="text-sm font-medium hidden sm:inline">{currentLang.name}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border 
                                py-2 z-50 animate-in fade-in slide-in-from-top-2">
                    {languages.map(lang => (
                        <button
                            key={lang.code}
                            onClick={() => {
                                changeLanguage(lang.code);
                                setIsOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-4 py-2.5 
                                       hover:bg-slate-50 transition-colors ${locale === lang.code ? 'bg-blue-50' : ''
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-xl">{lang.flag}</span>
                                <span className="font-medium text-slate-700">{lang.name}</span>
                            </div>
                            {locale === lang.code && (
                                <Check className="w-4 h-4 text-blue-500" />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default LanguageSelector;
