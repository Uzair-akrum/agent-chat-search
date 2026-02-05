/**
 * JSONL file reading utilities
 */

import { createReadStream } from 'fs';
import { createInterface } from 'readline';

/**
 * Read and parse a JSONL file line by line
 * Skips malformed lines gracefully
 */
export async function readJSONL(filePath: string): Promise<any[]> {
  const lines: any[] = [];

  try {
    const fileStream = createReadStream(filePath, { encoding: 'utf-8' });
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const parsed = JSON.parse(trimmed);
        lines.push(parsed);
      } catch (e) {
        // Skip malformed lines silently
        continue;
      }
    }
  } catch (error) {
    // File doesn't exist or can't be read
    return [];
  }

  return lines;
}
