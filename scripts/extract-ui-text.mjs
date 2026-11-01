import ts from 'typescript';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const files = ['src/App.tsx', 'src/data/parties.ts', 'src/lib/analyzer.ts', 'src/lib/polling.ts', 'src/lib/sharing.ts', ...readdirSync('src/components').filter(name => name.endsWith('.tsx') && !name.includes('.test.')).map(name => join('src/components', name))];
const found = new Set();
const skip = /^(?:https?:|\/|[.#]|[a-z]+[-_][a-z\d_-]+$|[a-z]+\.[a-z]+$|[A-Z0-9_]+$|[a-f\d]{6,}$)/;
function add(raw) {
  const value = raw.replace(/\s+/g, ' ').trim();
  if (!value || !/[A-Za-z]/.test(value) || skip.test(value) || value.length > 700) return;
  if (/^[\w.-]+$/.test(value) && !/^[A-Z]/.test(value)) return;
  if (/\b(?:className|onClick|aria-|data-|https?:|\.tsx|\.svg|\.png)\b/.test(value)) return;
  found.add(value);
}
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node) {
    if (ts.isJsxText(node)) add(node.getText(sf));
    if (ts.isJsxAttribute(node) && ['title', 'alt', 'aria-label', 'placeholder'].includes(node.name.text) && node.initializer && ts.isStringLiteral(node.initializer)) add(node.initializer.text);
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) add(node.text);
    if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) add(node.text);
    ts.forEachChild(node, visit);
  }
  visit(sf);
}
process.stdout.write(JSON.stringify([...found].sort((a,b) => a.localeCompare(b)), null, 2));
