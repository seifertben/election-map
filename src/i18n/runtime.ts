import es from './es.json';
import fr from './fr.json';
import de from './de.json';
import pt from './pt.json';
import { overrides } from './overrides';
import type { Mode } from '../types';

export type Locale = 'en' | 'es' | 'fr' | 'de' | 'pt-BR';
const catalogs: Record<Exclude<Locale, 'en'>, Record<string, string>> = {
  es: { ...es, ...overrides.es }, fr: { ...fr, ...overrides.fr }, de: { ...de, ...overrides.de }, 'pt-BR': { ...pt, ...overrides['pt-BR'] },
};

export function currentLocale(): Locale {
  if (typeof document === 'undefined') return 'en';
  const lang = document.documentElement.lang;
  return lang === 'es' || lang === 'fr' || lang === 'de' || lang === 'pt-BR' ? lang : 'en';
}

export function localePath(locale: Locale): string {
  const base = import.meta.env.BASE_URL;
  return `${base}${locale === 'en' ? '' : locale === 'pt-BR' ? 'pt-br/' : `${locale}/`}`;
}

export function languageUrl(locale: Locale): string {
  return `${localePath(locale)}${window.location.search}${window.location.hash}`;
}

export function localizedMapTitle(mode: Mode): string {
  const year = mode === 'president' ? '2024' : '2026';
  const locale = currentLocale();
  const names: Record<Locale, Record<Mode, string>> = {
    en: { president: 'presidential', senate: 'Senate', governor: 'governor', house: 'House' },
    es: { president: 'presidenciales', senate: 'Senado', governor: 'gobernaciones', house: 'Cámara de Representantes' },
    fr: { president: 'présidentielles', senate: 'Sénat', governor: 'gouverneurs', house: 'Chambre des représentants' },
    de: { president: 'Präsidentschaft', senate: 'Senat', governor: 'Gouverneursämter', house: 'Repräsentantenhaus' },
    'pt-BR': { president: 'presidenciais', senate: 'Senado', governor: 'governos estaduais', house: 'Câmara dos Representantes' },
  };
  if (locale === 'es') return `Mi mapa de las elecciones de ${year} para ${names.es[mode]}`;
  if (locale === 'fr') return `Ma carte des élections de ${year} pour ${names.fr[mode]}`;
  if (locale === 'de') return `Meine Wahlkarte ${year}: ${names.de[mode]}`;
  if (locale === 'pt-BR') return `Meu mapa das eleições de ${year} para ${names['pt-BR'][mode]}`;
  return `My ${year} ${names.en[mode]} election map`;
}

export function formatSourceDate(value: string): string {
  if (currentLocale() === 'en') return value;
  const parsed = new Date(`${value} 12:00:00 GMT`);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat(currentLocale(), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(parsed);
}

export function formatNumber(value: number, digits?: number): string {
  return new Intl.NumberFormat(currentLocale(), {
    minimumFractionDigits: digits ?? 0,
    maximumFractionDigits: digits ?? 1,
  }).format(value);
}

export function translateText(input: string, locale = currentLocale()): string {
  if (locale === 'en') return input;
  const called = input.match(/^(\d+) of (\d+) races called$/);
  if (called) {
    const [, count, total] = called;
    if (locale === 'es') return `${count} de ${total} elecciones adjudicadas`;
    if (locale === 'fr') return `${count} élections attribuées sur ${total}`;
    if (locale === 'de') return `${count} von ${total} Wahlen entschieden`;
    return `${count} de ${total} eleições definidas`;
  }
  const senateCaption = input.match(/^(\d+) of (\d+) seats up in (\d+) · (\d+) for a majority$/);
  if (senateCaption) {
    const [, up, total, year, majority] = senateCaption;
    if (locale === 'es') return `${up} de ${total} escaños en juego en ${year} · ${majority} para la mayoría`;
    if (locale === 'fr') return `${up} sièges sur ${total} en jeu en ${year} · ${majority} pour la majorité`;
    if (locale === 'de') return `${up} von ${total} Sitzen stehen ${year} zur Wahl · ${majority} für die Mehrheit`;
    return `${up} de ${total} cadeiras em disputa em ${year} · ${majority} para a maioria`;
  }
  const majorityCaption = input.match(/^(\d+) seats for a majority$/);
  if (majorityCaption) return locale === 'es' ? `${majorityCaption[1]} escaños para la mayoría` : locale === 'fr' ? `${majorityCaption[1]} sièges pour la majorité` : locale === 'de' ? `${majorityCaption[1]} Sitze für die Mehrheit` : `${majorityCaption[1]} cadeiras para a maioria`;
  const electoralCaption = input.match(/^(\d+) electoral votes to win$/);
  if (electoralCaption) return locale === 'es' ? `${electoralCaption[1]} votos electorales para ganar` : locale === 'fr' ? `${electoralCaption[1]} grands électeurs pour gagner` : locale === 'de' ? `${electoralCaption[1]} Wahlleute für den Sieg` : `${electoralCaption[1]} votos no colégio eleitoral para vencer`;
  const dictionary = catalogs[locale];
  const trimmed = input.trim();
  if (!trimmed) return input;
  const direct = dictionary[trimmed];
  if (direct) return input.replace(trimmed, direct);
  // React often creates a text node around a dynamic number or state name.
  // Translate its stable English fragments while retaining the live value.
  let output = input;
  const fragments = Object.keys(dictionary).filter(key => key.length >= 12 && input.includes(key)).sort((a,b) => b.length-a.length);
  for (const key of fragments) output = output.replaceAll(key, dictionary[key]);
  return output;
}

const translatedAttributes = ['aria-label', 'title', 'alt', 'placeholder'] as const;

function localizeElement(element: Element, locale: Locale) {
  for (const name of translatedAttributes) {
    const value = element.getAttribute(name);
    if (!value) continue;
    const translated = translateText(value, locale);
    if (translated !== value) element.setAttribute(name, translated);
  }
}

function localizeTree(node: Node, locale: Locale) {
  if (node.nodeType === Node.TEXT_NODE) {
    const value = node.nodeValue;
    if (value) {
      const translated = translateText(value, locale);
      if (translated !== value) node.nodeValue = translated;
    }
    return;
  }
  if (!(node instanceof Element)) return;
  localizeElement(node, locale);
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) localizeTree(walker.currentNode, locale);
  for (const element of node.querySelectorAll('[aria-label],[title],[alt],[placeholder]')) localizeElement(element, locale);
}

export function installLocale(root: HTMLElement): void {
  const locale = currentLocale();
  if (locale === 'en') return;
  document.documentElement.dataset.localizing = '';
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'characterData') localizeTree(record.target, locale);
      else if (record.type === 'attributes') localizeElement(record.target as Element, locale);
      else for (const node of record.addedNodes) localizeTree(node, locale);
    }
    delete document.documentElement.dataset.localizing;
  });
  observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...translatedAttributes] });
}
