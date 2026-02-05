import { describe, it, expect } from 'vitest';
import { readJSONL } from './jsonl.js';
import { writeFileSync, unlinkSync, mkdirSync, rmdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('readJSONL', () => {
  const testDir = join(tmpdir(), 'agent-chat-search-test-' + Date.now());

  it('should read valid JSONL file', async () => {
    const testFile = join(testDir, 'valid.jsonl');
    mkdirSync(testDir, { recursive: true });

    const content = [
      JSON.stringify({ id: 1, name: 'test1' }),
      JSON.stringify({ id: 2, name: 'test2' }),
      JSON.stringify({ id: 3, name: 'test3' }),
    ].join('\n');

    writeFileSync(testFile, content);

    const result = await readJSONL(testFile);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ id: 1, name: 'test1' });
    expect(result[2]).toEqual({ id: 3, name: 'test3' });

    unlinkSync(testFile);
    rmdirSync(testDir);
  });

  it('should skip malformed lines', async () => {
    const testFile = join(testDir, 'mixed.jsonl');
    mkdirSync(testDir, { recursive: true });

    const content = [
      JSON.stringify({ id: 1 }),
      'invalid json {',
      JSON.stringify({ id: 2 }),
      '',
      JSON.stringify({ id: 3 }),
    ].join('\n');

    writeFileSync(testFile, content);

    const result = await readJSONL(testFile);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ id: 1 });
    expect(result[1]).toEqual({ id: 2 });
    expect(result[2]).toEqual({ id: 3 });

    unlinkSync(testFile);
    rmdirSync(testDir);
  });

  it('should return empty array for non-existent file', async () => {
    const result = await readJSONL('/non/existent/file.jsonl');
    expect(result).toEqual([]);
  });

  it('should handle empty file', async () => {
    const testFile = join(testDir, 'empty.jsonl');
    mkdirSync(testDir, { recursive: true });

    writeFileSync(testFile, '');

    const result = await readJSONL(testFile);
    expect(result).toEqual([]);

    unlinkSync(testFile);
    rmdirSync(testDir);
  });

  it('should handle file with only whitespace', async () => {
    const testFile = join(testDir, 'whitespace.jsonl');
    mkdirSync(testDir, { recursive: true });

    writeFileSync(testFile, '\n\n  \n\n');

    const result = await readJSONL(testFile);
    expect(result).toEqual([]);

    unlinkSync(testFile);
    rmdirSync(testDir);
  });

  it('should handle CRLF line endings', async () => {
    const testFile = join(testDir, 'crlf.jsonl');
    mkdirSync(testDir, { recursive: true });

    const content = [JSON.stringify({ id: 1 }), JSON.stringify({ id: 2 })].join(
      '\r\n',
    );

    writeFileSync(testFile, content);

    const result = await readJSONL(testFile);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: 1 });
    expect(result[1]).toEqual({ id: 2 });

    unlinkSync(testFile);
    rmdirSync(testDir);
  });

  it('should handle nested objects', async () => {
    const testFile = join(testDir, 'nested.jsonl');
    mkdirSync(testDir, { recursive: true });

    const data = {
      id: 1,
      nested: { a: 1, b: { c: 2 } },
      array: [1, 2, 3],
    };
    writeFileSync(testFile, JSON.stringify(data));

    const result = await readJSONL(testFile);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(data);

    unlinkSync(testFile);
    rmdirSync(testDir);
  });
});
