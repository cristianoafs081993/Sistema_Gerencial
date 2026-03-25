/**
 * Robust CSV Line Splitter
 * Handles quoted fields and different separators.
 */
export const splitCsvLine = (line: string, sep: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === sep && !inQuotes) {
            result.push(cur.replace(/^"|"$/g, '').trim());
            cur = '';
        } else {
            cur += char;
        }
    }
    result.push(cur.replace(/^"|"$/g, '').trim());
    return result;
};
