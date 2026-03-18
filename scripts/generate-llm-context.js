import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUTPUT_FILE = path.join(PROJECT_ROOT, 'docs', 'llm', 'FULL_CONTEXT.md');

const IGNORE_DIRS = ['node_modules', '.git', 'dist', 'build', '.lovable', 'public'];
const IGNORE_FILES = ['package-lock.json', 'bun.lockb', '.DS_Store', 'FULL_CONTEXT.md'];
const ALLOWED_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.html'];

function generateTree(dir, prefix = '') {
    let output = '';
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    const filteredEntries = entries.filter(entry => {
        if (entry.isDirectory()) {
            return !IGNORE_DIRS.includes(entry.name);
        }
        return !IGNORE_FILES.includes(entry.name);
    });

    filteredEntries.forEach((entry, index) => {
        const isLast = index === filteredEntries.length - 1;
        const marker = isLast ? '└── ' : '├── ';
        const childPrefix = isLast ? '    ' : '│   ';

        output += `${prefix}${marker}${entry.name}\n`;

        if (entry.isDirectory()) {
            output += generateTree(path.join(dir, entry.name), prefix + childPrefix);
        }
    });

    return output;
}

function getFileContent(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf-8');
    } catch (e) {
        return `Error reading file: ${e.message}`;
    }
}

function processDirectory(dir) {
    let output = '';
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(PROJECT_ROOT, fullPath);

        if (entry.isDirectory()) {
            if (!IGNORE_DIRS.includes(entry.name)) {
                output += processDirectory(fullPath);
            }
        } else {
            if (IGNORE_FILES.includes(entry.name)) continue;

            const ext = path.extname(entry.name);
            if (ALLOWED_EXTENSIONS.includes(ext)) {
                output += `\n## File: ${relativePath}\n`;
                output += '```' + ext.substring(1) + '\n';
                output += getFileContent(fullPath);
                output += '\n```\n';
            }
        }
    }
    return output;
}

function main() {
    console.log('Generating LLM Context...');

    let content = '# Project Full Context\n\n';
    content += `Generated on: ${new Date().toISOString()}\n\n`;

    // 1. Directory Structure
    content += '## Project Directory Structure\n';
    content += '```\n';
    content += generateTree(PROJECT_ROOT);
    content += '```\n\n';

    // 2. High-level Documentation
    const docsDir = path.join(PROJECT_ROOT, 'docs', 'llm');
    if (fs.existsSync(docsDir)) {
        const docFiles = ['OVERVIEW.md', 'ARCHITECTURE.md', 'DATABASE_SCHEMA.md'];
        docFiles.forEach(docFile => {
            const docPath = path.join(docsDir, docFile);
            if (fs.existsSync(docPath)) {
                content += `\n# ${docFile}\n\n`;
                content += getFileContent(docPath) + '\n';
            }
        });
    }

    // 3. Source Code (Selective)
    // We strictly want to include src/types, src/services, and src/contexts first as they are critical
    const criticalDirs = ['src/types', 'src/services', 'src/contexts', 'src/lib', 'src/hooks', 'src/pages', 'src/components'];

    content += '\n# Source Code\n';

    // Add specific config files first
    const configFiles = ['package.json', 'vite.config.ts', 'tsconfig.json'];
    configFiles.forEach(file => {
        const filePath = path.join(PROJECT_ROOT, file);
        if (fs.existsSync(filePath)) {
            content += `\n## File: ${file}\n`;
            content += '```' + path.extname(file).substring(1) + '\n';
            content += getFileContent(filePath);
            content += '\n```\n';
        }
    });

    criticalDirs.forEach(relativeDir => {
        const fullDir = path.join(PROJECT_ROOT, relativeDir);
        if (fs.existsSync(fullDir)) {
            content += processDirectory(fullDir);
        }
    });

    fs.writeFileSync(OUTPUT_FILE, content);
    console.log(`Context generated at: ${OUTPUT_FILE}`);
}

main();
