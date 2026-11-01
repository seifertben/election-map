import { currentLocale, languageUrl } from '../i18n/runtime';
import type { Locale } from '../i18n/runtime';

const choices: { locale: Locale; label: string }[] = [
  { locale: 'en', label: 'English' },
  { locale: 'es', label: 'Español' },
  { locale: 'fr', label: 'Français' },
  { locale: 'de', label: 'Deutsch' },
  { locale: 'pt-BR', label: 'Português (Brasil)' },
];

export function LanguageSwitcher() {
  const active = currentLocale();
  return <nav className="language-switcher" aria-label="Language">
    <div className="language-switcher__links">
      {choices.map(({ locale, label }) => <a key={locale} href={languageUrl(locale)} hrefLang={locale} lang={locale} aria-current={active === locale ? 'page' : undefined} onClick={event => { event.currentTarget.href = languageUrl(locale); }}>{label}</a>)}
    </div>
    <select
      className="language-switcher__select"
      aria-label="Language"
      value={active}
      onChange={event => { window.location.href = languageUrl(event.target.value as Locale); }}
    >
      {choices.map(({ locale, label }) => <option key={locale} value={locale} lang={locale}>{label}</option>)}
    </select>
  </nav>;
}
