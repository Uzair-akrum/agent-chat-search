import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { OpenCodeReader } from './opencode.js';

const originalOpenCodeDataDir = process.env.OPENCODE_DATA_DIR;

function writeJSON(filePath: string, data: any) {
  const dir = filePath.substring(0, filePath.lastIndexOf('/'));
  mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, JSON.stringify(data));
}

/**
 * Helper: set up a minimal OpenCode storage structure.
 * Returns the storage root path.
 */
function setupStorage(
  storageDir: string,
  opts: {
    projectId: string;
    worktree: string;
    sessionId: string;
    messages: Array<{
      id: string;
      role: string;
      createdMs: number;
      parts: Array<{ id: string; type: string; text?: string }>;
    }>;
    sessionTitle?: string;
    sessionCreatedMs?: number;
  },
) {
  // project
  writeJSON(join(storageDir, 'project', `${opts.projectId}.json`), {
    id: opts.projectId,
    worktree: opts.worktree,
    time: { created: opts.sessionCreatedMs || 1700000000000 },
  });

  // session
  writeJSON(
    join(storageDir, 'session', opts.projectId, `${opts.sessionId}.json`),
    {
      id: opts.sessionId,
      projectID: opts.projectId,
      directory: opts.worktree,
      title: opts.sessionTitle || 'test session',
      time: { created: opts.sessionCreatedMs || 1700000000000 },
    },
  );

  // messages + parts
  for (const msg of opts.messages) {
    writeJSON(join(storageDir, 'message', opts.sessionId, `${msg.id}.json`), {
      id: msg.id,
      sessionID: opts.sessionId,
      role: msg.role,
      time: { created: msg.createdMs },
    });

    for (const part of msg.parts) {
      writeJSON(join(storageDir, 'part', msg.id, `${part.id}.json`), part);
    }
  }
}

describe('OpenCodeReader', () => {
  let testStorageDir: string;

  beforeEach(() => {
    testStorageDir = mkdtempSync(join(tmpdir(), 'agent-chat-search-opencode-'));
    process.env.OPENCODE_DATA_DIR = testStorageDir;
  });

  afterEach(() => {
    rmSync(testStorageDir, { recursive: true, force: true });

    if (originalOpenCodeDataDir === undefined) {
      delete process.env.OPENCODE_DATA_DIR;
    } else {
      process.env.OPENCODE_DATA_DIR = originalOpenCodeDataDir;
    }
  });

  it('should parse opencode session messages (user + assistant only)', async () => {
    setupStorage(testStorageDir, {
      projectId: 'proj-abc123',
      worktree: '/home/uzair/repos/project-a',
      sessionId: 'sess-001',
      sessionCreatedMs: 1700000000000,
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          createdMs: 1700000001000,
          parts: [{ id: 'part-1a', type: 'text', text: 'find my auth code' }],
        },
        {
          id: 'msg-2',
          role: 'assistant',
          createdMs: 1700000002000,
          parts: [
            { id: 'part-2a', type: 'text', text: 'Here is the auth handler.' },
          ],
        },
        {
          id: 'msg-3',
          role: 'system',
          createdMs: 1700000003000,
          parts: [
            { id: 'part-3a', type: 'text', text: 'internal instruction' },
          ],
        },
      ],
    });

    const reader = new OpenCodeReader();
    const sessions = await reader.findSessions();

    expect(sessions).toHaveLength(1);
    expect(sessions[0].sessionId).toBe('sess-001');
    expect(sessions[0].workDir).toBe('/home/uzair/repos/project-a');
    expect(sessions[0].messages).toHaveLength(2);
    expect(sessions[0].messages[0].role).toBe('user');
    expect(sessions[0].messages[1].role).toBe('assistant');
    expect(sessions[0].messages[0].content).toBe('find my auth code');
    expect(sessions[0].messages[1].content).toBe('Here is the auth handler.');
  });

  it('should include reasoning parts in text extraction', async () => {
    setupStorage(testStorageDir, {
      projectId: 'proj-reason',
      worktree: '/home/uzair/repos/project-r',
      sessionId: 'sess-reason',
      messages: [
        {
          id: 'msg-r1',
          role: 'assistant',
          createdMs: 1700000001000,
          parts: [
            { id: 'part-r1', type: 'reasoning', text: 'Let me think...' },
            { id: 'part-r2', type: 'text', text: 'Here is my answer.' },
          ],
        },
      ],
    });

    const reader = new OpenCodeReader();
    const sessions = await reader.findSessions();

    expect(sessions).toHaveLength(1);
    expect(sessions[0].messages[0].content).toBe(
      'Let me think...\nHere is my answer.',
    );
  });

  it('should skip tool and other non-text part types', async () => {
    setupStorage(testStorageDir, {
      projectId: 'proj-tool',
      worktree: '/home/uzair/repos/project-t',
      sessionId: 'sess-tool',
      messages: [
        {
          id: 'msg-t1',
          role: 'assistant',
          createdMs: 1700000001000,
          parts: [
            { id: 'part-t1', type: 'tool', text: undefined },
            { id: 'part-t2', type: 'step-start', text: undefined },
            { id: 'part-t3', type: 'text', text: 'The actual response.' },
            { id: 'part-t4', type: 'file', text: undefined },
          ],
        },
      ],
    });

    const reader = new OpenCodeReader();
    const sessions = await reader.findSessions();

    expect(sessions).toHaveLength(1);
    expect(sessions[0].messages[0].content).toBe('The actual response.');
  });

  it('should respect work directory filter', async () => {
    setupStorage(testStorageDir, {
      projectId: 'proj-a',
      worktree: '/home/uzair/repos/project-a',
      sessionId: 'sess-a',
      messages: [
        {
          id: 'msg-a1',
          role: 'user',
          createdMs: 1700000001000,
          parts: [{ id: 'part-a1', type: 'text', text: 'message a' }],
        },
      ],
    });

    setupStorage(testStorageDir, {
      projectId: 'proj-b',
      worktree: '/home/uzair/repos/project-b',
      sessionId: 'sess-b',
      messages: [
        {
          id: 'msg-b1',
          role: 'user',
          createdMs: 1700000001000,
          parts: [{ id: 'part-b1', type: 'text', text: 'message b' }],
        },
      ],
    });

    const reader = new OpenCodeReader();
    const sessions = await reader.findSessions('project-a');

    expect(sessions).toHaveLength(1);
    expect(sessions[0].sessionId).toBe('sess-a');
  });

  it('should read a specific session by ID', async () => {
    setupStorage(testStorageDir, {
      projectId: 'proj-read',
      worktree: '/home/uzair/repos/project-read',
      sessionId: 'sess-specific',
      messages: [
        {
          id: 'msg-s1',
          role: 'assistant',
          createdMs: 1700000001000,
          parts: [
            { id: 'part-s1', type: 'text', text: 'specific session result' },
          ],
        },
      ],
    });

    const reader = new OpenCodeReader();
    const session = await reader.readSession('sess-specific');

    expect(session).not.toBeNull();
    expect(session!.sessionId).toBe('sess-specific');
    expect(session!.messages).toHaveLength(1);
    expect(session!.messages[0].content).toBe('specific session result');
  });

  it('should return null for non-existent session ID', async () => {
    setupStorage(testStorageDir, {
      projectId: 'proj-x',
      worktree: '/tmp',
      sessionId: 'sess-x',
      messages: [
        {
          id: 'msg-x1',
          role: 'user',
          createdMs: 1700000001000,
          parts: [{ id: 'part-x1', type: 'text', text: 'hello' }],
        },
      ],
    });

    const reader = new OpenCodeReader();
    const session = await reader.readSession('non-existent-id');

    expect(session).toBeNull();
  });

  it('should return empty sessions when storage directory does not exist', async () => {
    rmSync(testStorageDir, { recursive: true, force: true });

    const reader = new OpenCodeReader();
    const sessions = await reader.findSessions();

    expect(sessions).toEqual([]);
  });

  it('should sort messages by creation time', async () => {
    setupStorage(testStorageDir, {
      projectId: 'proj-sort',
      worktree: '/tmp/sort',
      sessionId: 'sess-sort',
      messages: [
        {
          id: 'msg-late',
          role: 'assistant',
          createdMs: 1700000005000,
          parts: [{ id: 'part-late', type: 'text', text: 'second' }],
        },
        {
          id: 'msg-early',
          role: 'user',
          createdMs: 1700000001000,
          parts: [{ id: 'part-early', type: 'text', text: 'first' }],
        },
      ],
    });

    const reader = new OpenCodeReader();
    const sessions = await reader.findSessions();

    expect(sessions).toHaveLength(1);
    expect(sessions[0].messages[0].content).toBe('first');
    expect(sessions[0].messages[1].content).toBe('second');
  });

  it('should skip messages with no text parts', async () => {
    setupStorage(testStorageDir, {
      projectId: 'proj-empty',
      worktree: '/tmp/empty',
      sessionId: 'sess-empty',
      messages: [
        {
          id: 'msg-notext',
          role: 'assistant',
          createdMs: 1700000001000,
          parts: [
            { id: 'part-tool', type: 'tool' },
            { id: 'part-step', type: 'step-start' },
          ],
        },
        {
          id: 'msg-withtext',
          role: 'user',
          createdMs: 1700000002000,
          parts: [{ id: 'part-t', type: 'text', text: 'has text' }],
        },
      ],
    });

    const reader = new OpenCodeReader();
    const sessions = await reader.findSessions();

    expect(sessions).toHaveLength(1);
    expect(sessions[0].messages).toHaveLength(1);
    expect(sessions[0].messages[0].content).toBe('has text');
  });
});
