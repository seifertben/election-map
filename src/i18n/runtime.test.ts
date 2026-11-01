import { afterEach, describe, expect, it } from 'vitest';
import { currentLocale, installLocale, languageUrl, localizedMapTitle, translateText } from './runtime';

afterEach(() => {
  document.documentElement.lang = 'en';
  document.body.innerHTML = '';
  window.history.replaceState(null, '', '/');
});

describe('localized interface', () => {
  it('uses election terminology in each supported locale', () => {
    expect(translateText('House', 'es')).toBe('Cámara');
    expect(translateText('Tossup', 'fr')).toBe('Indécis');
    expect(translateText('Pickups', 'pt-BR')).toBe('Cadeiras conquistadas');
    expect(translateText('House', 'de')).toBe('Repräsentantenhaus');
    expect(translateText('Tossup', 'de')).toBe('Offen');
    expect(translateText('Reset shares', 'es')).toBe('Restablecer proporciones');
    expect(translateText('Shares are', 'de')).toBe('Die Anteile sind');
    expect(translateText('Pinch to zoom · Drag to pan', 'pt-BR')).toContain('dois dedos');
    expect(translateText('35 of 100 seats up in 2026 · 51 for a majority', 'de')).toBe('35 von 100 Sitzen stehen 2026 zur Wahl · 51 für die Mehrheit');
  });

  it('translates newly rendered text and accessibility labels', async () => {
    document.documentElement.lang = 'es';
    const root = document.createElement('div');
    document.body.append(root);
    installLocale(root);
    const button = document.createElement('button');
    button.textContent = 'Share map';
    button.setAttribute('aria-label', 'Close sharing');
    root.append(button);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(button.textContent).toBe('Compartir mapa');
    expect(button.getAttribute('aria-label')).toBe('Cerrar compartir');
    button.textContent = 'House';
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(button.textContent).toBe('Cámara');
  });

  it('keeps map state in language links and localizes share titles', () => {
    document.documentElement.lang = 'fr';
    window.history.replaceState(null, '', '/fr/?m=senate&c=abc#map');
    expect(currentLocale()).toBe('fr');
    expect(languageUrl('pt-BR')).toBe('/pt-br/?m=senate&c=abc#map');
    expect(localizedMapTitle('senate')).toContain('Sénat');
    expect(languageUrl('de')).toBe('/de/?m=senate&c=abc#map');
  });

  it('uses the German locale for translated UI and share titles', () => {
    document.documentElement.lang = 'de';
    expect(currentLocale()).toBe('de');
    expect(translateText('Close sharing')).toBe('Teilen schließen');
    expect(localizedMapTitle('house')).toContain('Repräsentantenhaus');
  });
});
