import fs from 'node:fs';
import path from 'node:path';

const parseEnvFile = (content) => {
  const parsed = {};
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed[key] = value;
  }

  return parsed;
};

export const loadProjectEnv = (cwd = process.cwd()) => {
  const envFiles = ['.env.local', '.env'];

  for (const fileName of envFiles) {
    const fullPath = path.resolve(cwd, fileName);
    if (!fs.existsSync(fullPath)) continue;

    const parsed = parseEnvFile(fs.readFileSync(fullPath, 'utf8'));
    for (const [key, value] of Object.entries(parsed)) {
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
};
