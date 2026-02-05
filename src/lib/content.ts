/**
 * Content extraction utilities for handling various message content formats
 */

/**
 * Recursively extract all string values from a nested object/array.
 * Used to pull searchable text from tool inputs and outputs.
 */
function extractStringsDeep(obj: any, depth: number = 0): string {
  if (depth > 4) return '';
  if (typeof obj === 'string') return obj;
  if (typeof obj === 'number' || typeof obj === 'boolean') return '';
  if (Array.isArray(obj)) {
    return obj
      .map(item => extractStringsDeep(item, depth + 1))
      .filter(Boolean)
      .join('\n');
  }
  if (typeof obj === 'object' && obj !== null) {
    return Object.values(obj)
      .map(v => extractStringsDeep(v, depth + 1))
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

/**
 * Extract text content from various content formats
 * Handles: strings, arrays of content blocks, thinking blocks, tool inputs/outputs
 */
export function extractTextContent(content: any): string {
  // Direct string content
  if (typeof content === 'string') {
    return content;
  }

  // Array of content blocks (Claude Code format)
  if (Array.isArray(content)) {
    return content
      .map(item => {
        if (typeof item === 'string') {
          return item;
        }

        // Text block
        if (item.type === 'text' && item.text) {
          return item.text;
        }

        // Thinking block (extended thinking)
        if (item.type === 'thinking' && item.thinking) {
          return `[Thinking: ${item.thinking}]`;
        }

        // Tool use block — extract actual input content for searchability
        if (item.type === 'tool_use') {
          const parts = [`[Tool: ${item.name}]`];
          if (item.input) {
            const inputText = extractStringsDeep(item.input);
            if (inputText) parts.push(inputText);
          }
          return parts.join('\n');
        }

        // Tool result block — extract actual output content for searchability
        if (item.type === 'tool_result') {
          const parts = ['[Tool Result]'];
          if (typeof item.content === 'string') {
            parts.push(item.content);
          } else if (Array.isArray(item.content)) {
            for (const block of item.content) {
              if (typeof block === 'string') {
                parts.push(block);
              } else if (block && block.text) {
                parts.push(block.text);
              } else if (block && block.content) {
                parts.push(extractStringsDeep(block.content));
              }
            }
          }
          return parts.filter(Boolean).join('\n');
        }

        return '';
      })
      .filter(text => text.length > 0)
      .join('\n');
  }

  // Object with text property
  if (content && typeof content === 'object' && content.text) {
    return content.text;
  }

  // Fallback to string conversion
  return String(content);
}

/**
 * Strip thinking blocks from content for cleaner search results
 */
export function stripThinkingBlocks(content: string): string {
  return content.replace(/\[Thinking:.*?\]/gs, '').trim();
}

/**
 * Truncate content to a maximum length with ellipsis
 */
export function truncateContent(content: string, maxLength: number = 500): string {
  if (content.length <= maxLength) {
    return content;
  }
  return content.substring(0, maxLength) + '...';
}
