import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import ru from './ru.json';
import uz from './uz.json';
import { buildMapI18n } from '../../core/maps/authored.ts';

export type Lang = 'en' | 'ru' | 'uz';

export const LANGUAGES: { code: Lang; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'uz', label: 'Oʻzbekcha', flag: '🇺🇿' },
];

/**
 * Register the authored maps' names/descriptions/locations as i18n keys
 * (EN/RU/UZ). These are kept out of the static JSON bundles (so the key-parity
 * test stays green) and merged into i18next at init time instead.
 */
function registerMapResources(): void {
  const bundles = buildMapI18n();
  i18n.addResourceBundle('en', 'translation', bundles.en, true, true);
  i18n.addResourceBundle('ru', 'translation', bundles.ru, true, true);
  i18n.addResourceBundle('uz', 'translation', bundles.uz, true, true);
}

export function initI18n(lang: Lang = 'en'): typeof i18n {
  if (!i18n.isInitialized) {
    void i18n.use(initReactI18next).init({
      resources: {
        en: { translation: en },
        ru: { translation: ru },
        uz: { translation: uz },
      },
      lng: lang,
      fallbackLng: 'en',
      interpolation: { escapeValue: false },
      returnNull: false,
    });
    registerMapResources();
  }
  return i18n;
}

/** Switch language at runtime (instant, no reload). */
export function setLanguage(lang: Lang): void {
  void i18n.changeLanguage(lang);
}

export default i18n;
