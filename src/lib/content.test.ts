import { describe, it, expect } from 'vitest';
import {
  extractTextContent,
  stripThinkingBlocks,
  truncateContent,
} from './content.js';

describe('extractTextContent', () => {
  it('should return string content unchanged', () => {
    expect(extractTextContent('hello world')).toBe('hello world');
    expect(extractTextContent('')).toBe('');
  });

  it('should extract text from array of strings', () => {
    expect(extractTextContent(['hello', 'world'])).toBe('hello\nworld');
    expect(extractTextContent(['single'])).toBe('single');
  });

  it('should extract text from content blocks', () => {
    const blocks = [
      { type: 'text', text: 'Hello' },
      { type: 'text', text: 'World' },
    ];
    expect(extractTextContent(blocks)).toBe('Hello\nWorld');
  });

  it('should extract thinking blocks with prefix', () => {
    const blocks = [{ type: 'thinking', thinking: 'I am thinking' }];
    expect(extractTextContent(blocks)).toBe('[Thinking: I am thinking]');
  });

  it('should handle tool_use blocks', () => {
    const blocks = [
      { type: 'tool_use', name: 'myTool', input: { key: 'value' } },
    ];
    const result = extractTextContent(blocks);
    expect(result).toContain('[Tool: myTool]');
    expect(result).toContain('value');
  });

  it('should handle tool_result blocks with string content', () => {
    const blocks = [{ type: 'tool_result', content: 'result text' }];
    expect(extractTextContent(blocks)).toContain('result text');
  });

  it('should handle tool_result blocks with array content', () => {
    const blocks = [
      {
        type: 'tool_result',
        content: [{ text: 'result1' }, { text: 'result2' }],
      },
    ];
    const result = extractTextContent(blocks);
    expect(result).toContain('result1');
    expect(result).toContain('result2');
  });

  it('should handle mixed content blocks', () => {
    const blocks = [
      'plain text',
      { type: 'text', text: 'text block' },
      { type: 'unknown', data: 'ignored' },
    ];
    const result = extractTextContent(blocks);
    expect(result).toContain('plain text');
    expect(result).toContain('text block');
  });

  it('should extract text from object with text property', () => {
    expect(extractTextContent({ text: 'object text' })).toBe('object text');
  });

  it('should return object string for object without text property', () => {
    // Objects without text property fall through to String() conversion
    expect(extractTextContent({ other: 'field' })).toBe('[object Object]');
  });

  it('should convert other types to string', () => {
    expect(extractTextContent(null)).toBe('null');
    expect(extractTextContent(undefined)).toBe('undefined');
    expect(extractTextContent(123)).toBe('123');
  });

  it('should skip empty strings in arrays', () => {
    const blocks = [
      { type: 'text', text: 'hello' },
      { type: 'text', text: '' },
      { type: 'text', text: 'world' },
    ];
    expect(extractTextContent(blocks)).toBe('hello\nworld');
  });
});

describe('stripThinkingBlocks', () => {
  it('should remove thinking blocks from content', () => {
    const content = 'Hello [Thinking: some thought] World';
    expect(stripThinkingBlocks(content)).toBe('Hello  World');
  });

  it('should handle multiline thinking blocks', () => {
    const content = `Start [Thinking:
    multiline
    thinking
    ] End`;
    expect(stripThinkingBlocks(content)).toBe('Start  End');
  });

  it('should return content unchanged if no thinking blocks', () => {
    const content = 'No thinking here';
    expect(stripThinkingBlocks(content)).toBe('No thinking here');
  });

  it('should handle multiple thinking blocks', () => {
    const content = 'Start [Thinking: first] middle [Thinking: second] end';
    expect(stripThinkingBlocks(content)).toBe('Start  middle  end');
  });

  it('should trim the result', () => {
    expect(stripThinkingBlocks('  hello  ')).toBe('hello');
    expect(stripThinkingBlocks('[Thinking: thought] ')).toBe('');
  });
});

describe('truncateContent', () => {
  it('should return content unchanged if under max length', () => {
    expect(truncateContent('short', 100)).toBe('short');
    expect(truncateContent('', 10)).toBe('');
  });

  it('should truncate content over max length', () => {
    const content = 'a'.repeat(150);
    const result = truncateContent(content, 100);
    expect(result).toBe('a'.repeat(100) + '...');
    expect(result.length).toBe(103);
  });

  it('should use default max length', () => {
    const content = 'a'.repeat(600);
    const result = truncateContent(content);
    expect(result.endsWith('...')).toBe(true);
    expect(result.length).toBe(503); // 500 + 3 for ...
  });

  it('should handle exact length content', () => {
    const content = 'a'.repeat(100);
    expect(truncateContent(content, 100)).toBe(content);
  });
});
