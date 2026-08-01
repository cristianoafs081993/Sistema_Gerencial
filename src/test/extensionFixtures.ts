import { resolve } from 'node:path';

export const CURRENT_EXTENSION_VERSION = '1.9';
export const CURRENT_EXTENSION_DIR = resolve(process.cwd(), `SUAP-Atividades-Scraper-${CURRENT_EXTENSION_VERSION}`);

export function extensionFixturePath(fileName: string) {
  return resolve(CURRENT_EXTENSION_DIR, fileName);
}
