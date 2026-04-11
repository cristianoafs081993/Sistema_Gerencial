import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const scannedRoots = ['src', path.join('docs', 'design-system')];
const scannedExtensions = new Set(['.css', '.md', '.ts', '.tsx']);
const checkedCharacters = Array.from(
  new Set([
    ...'áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇüÜºª',
    '–',
    '—',
    '→',
    '✓',
    '✗',
    '⚠',
    '›',
    '─',
    '▲',
    '▼',
    '…',
    '“',
    '”',
    '’',
    '‑',
  ]),
);

function mojibakeVariantsFor(char: string) {
  const once = Buffer.from(char, 'utf8').toString('latin1');
  const twice = Buffer.from(once, 'utf8').toString('latin1');
  return [once, twice].filter((variant) => variant !== char);
}

function listFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];

  const entries = fs.readdirSync(root, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) return listFiles(fullPath);
    return scannedExtensions.has(path.extname(entry.name)) ? [fullPath] : [];
  });
}

describe('source text encoding', () => {
  it('does not commit UTF-8 text rendered as Latin-1 mojibake', () => {
    const badNeedles = Array.from(new Set(checkedCharacters.flatMap(mojibakeVariantsFor)));
    const findings: string[] = [];

    for (const filePath of scannedRoots.flatMap(listFiles)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split(/\r?\n/);

      lines.forEach((line, index) => {
        const badNeedle = badNeedles.find((needle) => line.includes(needle));
        if (badNeedle) findings.push(`${filePath}:${index + 1}: ${badNeedle}`);
      });
    }

    expect(findings).toEqual([]);
  });
});
