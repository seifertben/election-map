import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { ElectionInfo } from './ElectionInfo';
import type { Mode } from '../types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  document.documentElement.lang = 'en';
});

function render(mode: Mode, lang = 'en') {
  document.documentElement.lang = lang;
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(<ElectionInfo mode={mode} />));
  cleanup = () => { act(() => root.unmount()); container.remove(); };
  const trigger = container.querySelector<HTMLButtonElement>('.election-info__trigger')!;
  act(() => trigger.click());
  return { container, trigger, dialog: container.querySelector<HTMLDialogElement>('dialog')! };
}

describe('ElectionInfo', () => {
  it.each([
    ['president', '538', '270', 'executive branch'],
    ['senate', '100', '35', 'federal laws'],
    ['house', '435', '218', 'congressional districts'],
    ['governor', '50', '36', 'state laws'],
  ] as const)('explains the %s election and closes accessibly', (mode, count, electionCount, role) => {
    const { container, trigger, dialog } = render(mode);
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    expect(trigger.getAttribute('aria-label')).toBe('How this election works');
    expect(trigger.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(dialog.getAttribute('aria-labelledby')).toBe('election-info-title');
    expect(dialog.textContent).toContain(count);
    expect(dialog.textContent).toContain(electionCount);
    expect(dialog.textContent).toContain(role);
    act(() => container.querySelector<HTMLButtonElement>('.election-info__close')!.click());
    expect(container.querySelector('dialog')).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it.each([
    ['es', 'Cómo funciona', 'Cómo funciona esta elección', 'Elecciones al Senado'],
    ['fr', 'Comment ça marche', 'Comment fonctionne cette élection', 'Élections au Sénat'],
    ['de', 'So funktioniert’s', 'So funktioniert diese Wahl', 'Wahlen zum US-Senat'],
    ['pt-BR', 'Como funciona', 'Como funciona esta eleição', 'Eleições para o Senado'],
  ])('shows localized information in %s', (lang, button, label, title) => {
    const { trigger, dialog } = render('senate', lang);
    expect(trigger.textContent).toContain(button);
    expect(trigger.getAttribute('aria-label')).toBe(label);
    expect(dialog.querySelector('h2')?.textContent).toContain(title);
    expect(dialog.querySelectorAll('li')).toHaveLength(3);
  });
});
