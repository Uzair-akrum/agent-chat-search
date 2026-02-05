/**
 * Content extraction utilities for handling various message content formats
 */

/**
 * Extract text content from various content formats
 * Handles: strings, arrays of content blocks, thinking blocks, tool outputs
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

        // Tool use block
        if (item.type === 'tool_use') {
          return `[Tool: ${item.name}]`;
        }

        // Tool result block
        if (item.type === 'tool_result') {
          return `[Tool Result: ${item.tool_use_id}]`;
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
