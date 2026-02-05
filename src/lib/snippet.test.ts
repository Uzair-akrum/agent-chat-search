import { describe, it, expect } from 'vitest';
import {
  estimateTokens,
  findWordBoundary,
  extractSnippet,
  mergeOverlappingRanges,
  applyContentLimit,
  generateSessionSummary,
  calculateShownPercentage,
  formatTruncationInfo,
  enforceTokenBudget,
  DEFAULT_SNIPPET_CONFIG,
} from './snippet.js';

describe('estimateTokens', () => {
  it('should estimate tokens correctly for simple text', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('test')).toBe(1);
    expect(estimateTokens('a'.repeat(40))).toBe(10);
    expect(estimateTokens('a'.repeat(100))).toBe(25);
  });
});

describe('findWordBoundary', () => {
  it('should return 0 for position 0', () => {
    expect(findWordBoundary('hello world', 0)).toBe(0);
  });

  it('should return content length for position >= content length', () => {
    expect(findWordBoundary('hello', 5)).toBe(5);
    expect(findWordBoundary('hello', 10)).toBe(5);
  });

  it('should find nearest word boundary backward', () => {
    // Position 8 in "hello world test" is the 'r' in "world"
    // The function searches backward for word boundary (within MAX_WORD_BOUNDARY_SEARCH=20)
    // Position 8, searching back finds space at position 5
    expect(findWordBoundary('hello world test', 8)).toBe(5); // Space after "hello"
    expect(findWordBoundary('hello.world', 5)).toBe(5); // At the '.'
  });

  it('should find nearest word boundary forward', () => {
    expect(findWordBoundary('hello world', 3, 'forward')).toBe(5); // "hello"
  });
});

describe('extractSnippet', () => {
  it('should return empty snippet for empty content', () => {
    const result = extractSnippet('', 0, 0, 100);
    expect(result.snippet).toBe('');
    expect(result.metadata.content_truncated).toBe(false);
  });

  it('should return full content if smaller than snippet size', () => {
    const content = 'short text';
    const result = extractSnippet(content, 0, 5, 100);
    expect(result.snippet).toBe(content);
    expect(result.metadata.content_truncated).toBe(false);
  });

  it('should extract snippet around match position', () => {
    const content = 'a'.repeat(100) + 'MATCH' + 'b'.repeat(100);
    const matchStart = 100;
    const matchEnd = 105;
    const result = extractSnippet(content, matchStart, matchEnd, 20);

    expect(result.metadata.content_truncated).toBe(true);
    expect(result.metadata.original_length).toBe(205);
    expect(result.snippet).toContain('MATCH');
  });
});

describe('mergeOverlappingRanges', () => {
  it('should return empty array for empty input', () => {
    expect(mergeOverlappingRanges([])).toEqual([]);
  });

  it('should return single range unchanged', () => {
    expect(mergeOverlappingRanges([{ start: 0, end: 10 }])).toEqual([
      { start: 0, end: 10 },
    ]);
  });

  it('should merge overlapping ranges', () => {
    const ranges = [
      { start: 0, end: 10 },
      { start: 8, end: 15 }, // Overlaps with first
      { start: 18, end: 30 }, // Adjacent to merged first range (within 10 chars of 15)
    ];
    const result = mergeOverlappingRanges(ranges);
    // 0-15 and 18-30 are within 10 chars (3 apart), so they merge to 0-30
    expect(result).toEqual([{ start: 0, end: 30 }]);
  });

  it('should merge adjacent ranges (within 10 chars)', () => {
    const ranges = [
      { start: 0, end: 10 },
      { start: 18, end: 25 }, // Within 10 chars
      { start: 50, end: 60 }, // Not adjacent
    ];
    const result = mergeOverlappingRanges(ranges);
    expect(result).toEqual([
      { start: 0, end: 25 },
      { start: 50, end: 60 },
    ]);
  });
});

describe('applyContentLimit', () => {
  it('should return content unchanged if under limit', () => {
    const content = 'short';
    const result = applyContentLimit(content, 100);
    expect(result.content).toBe(content);
    expect(result.metadata.content_truncated).toBe(false);
  });

  it('should truncate content over limit', () => {
    const content = 'a'.repeat(200);
    const result = applyContentLimit(content, 100);
    expect(result.content.endsWith('...')).toBe(true);
    expect(result.metadata.content_truncated).toBe(true);
    expect(result.metadata.truncation_type).toBe('length');
  });
});

describe('generateSessionSummary', () => {
  it('should generate correct summary', () => {
    expect(generateSessionSummary(10, 0, 'user')).toBe(
      'user message 1/10 (0% through session)',
    );
    expect(generateSessionSummary(10, 4, 'assistant')).toBe(
      'assistant message 5/10 (40% through session)',
    );
    expect(generateSessionSummary(100, 99, 'tool')).toBe(
      'tool message 100/100 (99% through session)',
    );
  });
});

describe('calculateShownPercentage', () => {
  it('should return 100 for non-truncated content', () => {
    expect(
      calculateShownPercentage({
        content_truncated: false,
        original_length: 100,
        snippet_start: 0,
        snippet_end: 100,
        truncation_type: 'none',
      }),
    ).toBe(100);
  });

  it('should calculate correct percentage', () => {
    expect(
      calculateShownPercentage({
        content_truncated: true,
        original_length: 100,
        snippet_start: 0,
        snippet_end: 50,
        truncation_type: 'snippet',
      }),
    ).toBe(50);

    expect(
      calculateShownPercentage({
        content_truncated: true,
        original_length: 100,
        snippet_start: 25,
        snippet_end: 75,
        truncation_type: 'snippet',
      }),
    ).toBe(50);
  });
});

describe('formatTruncationInfo', () => {
  it('should return empty string for non-truncated content', () => {
    expect(
      formatTruncationInfo({
        content_truncated: false,
        original_length: 100,
        snippet_start: 0,
        snippet_end: 100,
        truncation_type: 'none',
      }),
    ).toBe('');
  });

  it('should format truncation info correctly', () => {
    const info = formatTruncationInfo({
      content_truncated: true,
      original_length: 100,
      snippet_start: 0,
      snippet_end: 50,
      truncation_type: 'snippet',
    });
    expect(info).toContain('50%');
    expect(info).toContain('snippet');
  });
});

describe('enforceTokenBudget', () => {
  it('should return all matches if under budget', () => {
    const matches = [
      { message: { content: 'short' } },
      { message: { content: 'also short' } },
    ];
    const result = enforceTokenBudget(matches, 1000);
    expect(result.matches).toHaveLength(2);
    expect(result.budgetExceeded).toBe(false);
  });

  it('should truncate matches when budget exceeded', () => {
    // Create a match that exceeds the token budget
    const matches = [
      { message: { content: 'a'.repeat(400) } }, // ~100 tokens
      { message: { content: 'b'.repeat(400) } }, // ~100 tokens
      { message: { content: 'c'.repeat(400) } }, // ~100 tokens
    ];
    const result = enforceTokenBudget(matches, 250); // ~62 token budget
    expect(result.matches.length).toBeLessThan(3);
    expect(result.budgetExceeded).toBe(true);
  });

  it('should return empty array for empty matches', () => {
    const result = enforceTokenBudget([], 100);
    expect(result.matches).toEqual([]);
    expect(result.budgetExceeded).toBe(false);
    expect(result.estimatedTokens).toBe(0);
  });
});

describe('DEFAULT_SNIPPET_CONFIG', () => {
  it('should have expected default values', () => {
    expect(DEFAULT_SNIPPET_CONFIG.mode).toBe('snippet');
    expect(DEFAULT_SNIPPET_CONFIG.snippetSize).toBe(200);
    expect(DEFAULT_SNIPPET_CONFIG.maxContentLength).toBe(500);
    expect(DEFAULT_SNIPPET_CONFIG.contextWindow).toBe(4096);
  });
});
