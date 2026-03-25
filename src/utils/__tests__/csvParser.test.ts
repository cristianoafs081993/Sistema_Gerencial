import { describe, it, expect } from 'vitest';
import { splitCsvLine } from '../csvParser';

describe('splitCsvLine', () => {
  it('should split by comma correctly', () => {
    const line = 'val1,val2,val3';
    expect(splitCsvLine(line, ',')).toEqual(['val1', 'val2', 'val3']);
  });

  it('should handle quoted values containing commas', () => {
    const line = '"123,45",val2,"val, 3"';
    // Note: My implementation currently removes quotes
    expect(splitCsvLine(line, ',')).toEqual(['123,45', 'val2', 'val, 3']);
  });

  it('should handle TAB separator', () => {
    const line = 'val1\tval2\tval3';
    expect(splitCsvLine(line, '\t')).toEqual(['val1', 'val2', 'val3']);
  });

  it('should handle empty fields', () => {
    const line = 'val1,,val3';
    expect(splitCsvLine(line, ',')).toEqual(['val1', '', 'val3']);
  });

  it('should handle trailing separators', () => {
    const line = 'val1,val2,';
    expect(splitCsvLine(line, ',')).toEqual(['val1', 'val2', '']);
  });
});
