import { currentLocale, languageUrl } from '../i18n/runtime';
import type { Locale } from '../i18n/runtime';

const choices: { locale: Locale; label: string }[] = [
  { locale: 'en', label: 'English' },
  { locale: 'es', label: 'Español' },
  { locale: 'fr', label: 'Français' },
  { locale: 'pt-BR', label: 'Português (Brasil)' },
];

export function LanguageSwitcher() {
  const active = currentLocale();
  return <nav className="language-switcher" aria-label="Language">
    {choices.map(({ locale, label }) => <a key={locale} href={languageUrl(locale)} hrefLang={locale} lang={locale} aria-current={active === locale ? 'page' : undefined} onClick={event => { event.currentTarget.href = languageUrl(locale); }}>{label}</a>)}
  </nav>;
}
