import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { tmpdir } from 'os';
import { CodexReader } from './codex.js';

const originalCodexHome = process.env.CODEX_HOME;

function writeJSONL(filePath: string, lines: any[]) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, lines.map((line) => JSON.stringify(line)).join('\n'));
}

describe('CodexReader', () => {
  let testCodexHome: string;

  beforeEach(() => {
    testCodexHome = mkdtempSync(join(tmpdir(), 'agent-chat-search-codex-'));
    process.env.CODEX_HOME = testCodexHome;
  });

  afterEach(() => {
    rmSync(testCodexHome, { recursive: true, force: true });

    if (originalCodexHome === undefined) {
      delete process.env.CODEX_HOME;
    } else {
      process.env.CODEX_HOME = originalCodexHome;
    }
  });

  it('should parse codex session messages (user + assistant only)', async () => {
    const sessionId = '019c2e91-cea1-7d70-aeef-6b9da0774431';
    const filePath = join(
      testCodexHome,
      'sessions',
      '2026',
      '02',
      '05',
      `rollout-2026-02-05T21-10-33-${sessionId}.jsonl`,
    );

    writeJSONL(filePath, [
      {
        timestamp: '2026-02-05T21:10:33.100Z',
        type: 'session_meta',
        payload: {
          id: sessionId,
          timestamp: '2026-02-05T21:10:33.090Z',
          cwd: '/home/uzair/repos/project-a',
        },
      },
      {
        timestamp: '2026-02-05T21:10:34.000Z',
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'find my auth code' }],
        },
      },
      {
        timestamp: '2026-02-05T21:10:35.000Z',
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'Here is the auth handler.' }],
        },
      },
      {
        timestamp: '2026-02-05T21:10:36.000Z',
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'developer',
          content: [{ type: 'input_text', text: 'internal instruction' }],
        },
      },
      {
        timestamp: '2026-02-05T21:10:37.000Z',
        type: 'event_msg',
        payload: { type: 'token_count' },
      },
    ]);

    const reader = new CodexReader();
    const sessions = await reader.findSessions();

    expect(sessions).toHaveLength(1);
    expect(sessions[0].sessionId).toBe(sessionId);
    expect(sessions[0].workDir).toBe('/home/uzair/repos/project-a');
    expect(sessions[0].messages).toHaveLength(2);
    expect(sessions[0].messages[0].role).toBe('user');
    expect(sessions[0].messages[1].role).toBe('assistant');
    expect(sessions[0].messages[0].content).toBe('find my auth code');
    expect(sessions[0].messages[1].content).toBe('Here is the auth handler.');
  });

  it('should fallback to filename session ID when session_meta ID is missing', async () => {
    const sessionId = '019c2fd2-8f99-7ec3-bb18-59060ddde2ce';
    const filePath = join(
      testCodexHome,
      'sessions',
      '2026',
      '02',
      '06',
      `rollout-2026-02-06T03-00-54-${sessionId}.jsonl`,
    );

    writeJSONL(filePath, [
      {
        timestamp: '2026-02-06T03:00:54.000Z',
        type: 'session_meta',
        payload: {
          cwd: '/home/uzair/repos/project-b',
        },
      },
      {
        timestamp: '2026-02-06T03:00:55.000Z',
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'hello codex' }],
        },
      },
    ]);

    const reader = new CodexReader();
    const sessions = await reader.findSessions();

    expect(sessions).toHaveLength(1);
    expect(sessions[0].sessionId).toBe(sessionId);
  });

  it('should respect work directory filter', async () => {
    const sessionA = '019c2fd2-8f99-7ec3-bb18-59060ddde2ce';
    const sessionB = '019c2fd2-ce68-70b2-8720-7172819713cc';

    const fileA = join(
      testCodexHome,
      'sessions',
      '2026',
      '02',
      '06',
      `rollout-2026-02-06T03-00-54-${sessionA}.jsonl`,
    );
    const fileB = join(
      testCodexHome,
      'sessions',
      '2026',
      '02',
      '06',
      `rollout-2026-02-06T03-01-10-${sessionB}.jsonl`,
    );

    writeJSONL(fileA, [
      {
        timestamp: '2026-02-06T03:00:54.000Z',
        type: 'session_meta',
        payload: {
          id: sessionA,
          cwd: '/home/uzair/repos/project-a',
        },
      },
      {
        timestamp: '2026-02-06T03:00:55.000Z',
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'message a' }],
        },
      },
    ]);

    writeJSONL(fileB, [
      {
        timestamp: '2026-02-06T03:01:10.000Z',
        type: 'session_meta',
        payload: {
          id: sessionB,
          cwd: '/home/uzair/repos/project-b',
        },
      },
      {
        timestamp: '2026-02-06T03:01:11.000Z',
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'message b' }],
        },
      },
    ]);

    const reader = new CodexReader();
    const sessions = await reader.findSessions('project-a');

    expect(sessions).toHaveLength(1);
    expect(sessions[0].sessionId).toBe(sessionA);
  });

  it('should read a specific session by ID', async () => {
    const sessionId = '019c2fa6-f43c-71d0-8f7f-726e17f06c65';
    const filePath = join(
      testCodexHome,
      'sessions',
      '2026',
      '02',
      '06',
      `rollout-2026-02-06T02-13-16-${sessionId}.jsonl`,
    );

    writeJSONL(filePath, [
      {
        timestamp: '2026-02-06T02:13:16.000Z',
        type: 'session_meta',
        payload: {
          id: sessionId,
          cwd: '/home/uzair/repos/project-c',
        },
      },
      {
        timestamp: '2026-02-06T02:13:17.000Z',
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'specific session result' }],
        },
      },
    ]);

    const reader = new CodexReader();
    const session = await reader.readSession(sessionId);

    expect(session).not.toBeNull();
    expect(session!.sessionId).toBe(sessionId);
    expect(session!.messages).toHaveLength(1);
    expect(session!.messages[0].content).toBe('specific session result');
  });

  it('should return empty sessions when codex directory does not exist', async () => {
    rmSync(testCodexHome, { recursive: true, force: true });

    const reader = new CodexReader();
    const sessions = await reader.findSessions();

    expect(sessions).toEqual([]);
  });
});
