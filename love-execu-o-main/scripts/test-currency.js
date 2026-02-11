
const parseCurrency = (value) => {
    if (!value || value === '0') return 0;

    // Log input to see what we are dealing with
    console.log(`Parsing input: "${value}"`);

    const cleaned = value
        .replace(/R\$\s*/gi, '')
        .replace(/\s/g, '')
        .trim();

    console.log(`Cleaned: "${cleaned}"`);

    if (cleaned.includes(',') && cleaned.includes('.')) {
        const lastComma = cleaned.lastIndexOf(',');
        const lastDot = cleaned.lastIndexOf('.');
        if (lastComma > lastDot) {
            // Format: 1.000,00
            console.log('Detected format: 1.000,00');
            return parseFloat(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
        }
        // Format: 1,000.00
        console.log('Detected format: 1,000.00');
        return parseFloat(cleaned.replace(/,/g, '')) || 0;
    }

    if (cleaned.includes(',')) {
        // Format: 1000,00
        console.log('Detected format: 1000,00');
        return parseFloat(cleaned.replace(',', '.')) || 0;
    }

    // Format: 1000.00 or 1000
    console.log('Detected format: 1000.00 or integer');
    return parseFloat(cleaned) || 0;
};

// Test cases
const tests = [
    "1.000,00",
    "1,000.00",
    "1000,00",
    "1000.00",
    "R$ 1.234,56",
    "R$ 1,234.56",
    "1.234.567,89",
    "0,00",
    "-",
    "R$ -",
    "mil e quinhentos" // garbage
];

tests.forEach(t => {
    console.log(`Result for "${t}":`, parseCurrency(t));
    console.log('---');
});
