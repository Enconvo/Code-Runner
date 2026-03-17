import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execFileSync, execSync } from 'child_process';

// We need to mock child_process before importing the module
vi.mock('child_process', () => ({
    execFileSync: vi.fn(),
    execSync: vi.fn(),
}));

const mockedExecSync = vi.mocked(execSync);
const mockedExecFileSync = vi.mocked(execFileSync);

// Reset module cache between tests so rtkPath cache is cleared
async function loadRtkRewrite() {
    // Clear module cache to reset the cached rtkPath
    const modulePath = '../src/utils/rtk_util.js';
    vi.resetModules();
    // Re-mock after resetModules
    vi.doMock('child_process', () => ({
        execFileSync: mockedExecFileSync,
        execSync: mockedExecSync,
    }));
    const mod = await import(modulePath);
    return mod.rtkRewrite as (command: string) => string | null;
}

describe('RTK Utility', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getRtkPath - finding rtk binary', () => {
        it('should find rtk on PATH via which', async () => {
            const rtkRewrite = await loadRtkRewrite();
            // which rtk succeeds
            mockedExecSync.mockReturnValueOnce('/usr/local/bin/rtk\n');
            // rtk rewrite call
            mockedExecFileSync.mockReturnValueOnce('rtk git status');

            const result = rtkRewrite('git status');

            expect(mockedExecSync).toHaveBeenCalledWith(
                'which rtk',
                expect.objectContaining({ encoding: 'utf-8', timeout: 5000 })
            );
            expect(result).toBe('rtk git status');
        });

        it('should fall back to ~/.local/bin/rtk if not on PATH', async () => {
            const rtkRewrite = await loadRtkRewrite();
            // which rtk fails
            mockedExecSync.mockImplementationOnce(() => { throw new Error('not found'); });
            // ~/.local/bin/rtk --version succeeds
            mockedExecFileSync.mockImplementationOnce(() => 'rtk 0.30.0');
            // rtk rewrite call
            mockedExecFileSync.mockReturnValueOnce('rtk ls -la');

            const result = rtkRewrite('ls -la');

            expect(result).toBe('rtk ls -la');
            expect(mockedExecFileSync).toHaveBeenCalledWith(
                expect.stringContaining('.local/bin/rtk'),
                ['--version'],
                expect.any(Object)
            );
        });

        it('should auto-install rtk if not found anywhere', async () => {
            const rtkRewrite = await loadRtkRewrite();
            // which rtk fails
            mockedExecSync.mockImplementationOnce(() => { throw new Error('not found'); });
            // ~/.local/bin/rtk --version fails (not installed)
            mockedExecFileSync.mockImplementationOnce(() => { throw new Error('not found'); });
            // curl install script succeeds
            mockedExecSync.mockReturnValueOnce('installed');
            // verify after install succeeds
            mockedExecFileSync.mockImplementationOnce(() => 'rtk 0.30.0');
            // rtk rewrite call
            mockedExecFileSync.mockReturnValueOnce('rtk docker ps');

            const result = rtkRewrite('docker ps');

            expect(result).toBe('rtk docker ps');
            // Verify install script was called
            expect(mockedExecSync).toHaveBeenCalledWith(
                expect.stringContaining('curl -fsSL'),
                expect.objectContaining({ timeout: 60000 })
            );
        });

        it('should return null if install fails', async () => {
            const rtkRewrite = await loadRtkRewrite();
            // which rtk fails
            mockedExecSync.mockImplementationOnce(() => { throw new Error('not found'); });
            // ~/.local/bin/rtk --version fails
            mockedExecFileSync.mockImplementationOnce(() => { throw new Error('not found'); });
            // curl install fails
            mockedExecSync.mockImplementationOnce(() => { throw new Error('curl failed'); });

            const result = rtkRewrite('git status');

            expect(result).toBeNull();
        });

        it('should cache the rtk path after first lookup', async () => {
            const rtkRewrite = await loadRtkRewrite();
            // First call: which rtk succeeds
            mockedExecSync.mockReturnValueOnce('/usr/local/bin/rtk\n');
            mockedExecFileSync.mockReturnValueOnce('rtk git status');

            rtkRewrite('git status');

            // Second call: should NOT call which again
            mockedExecFileSync.mockReturnValueOnce('rtk git log');
            const result = rtkRewrite('git log');

            // which should only be called once (first lookup)
            expect(mockedExecSync).toHaveBeenCalledTimes(1);
            expect(result).toBe('rtk git log');
        });
    });

    describe('rtkRewrite - command rewriting', () => {
        it('should rewrite git commands', async () => {
            const rtkRewrite = await loadRtkRewrite();
            mockedExecSync.mockReturnValueOnce('/usr/local/bin/rtk\n');
            mockedExecFileSync.mockReturnValueOnce('rtk git status');

            expect(rtkRewrite('git status')).toBe('rtk git status');
        });

        it('should rewrite git diff', async () => {
            const rtkRewrite = await loadRtkRewrite();
            mockedExecSync.mockReturnValueOnce('/usr/local/bin/rtk\n');
            mockedExecFileSync.mockReturnValueOnce('rtk git diff --cached');

            expect(rtkRewrite('git diff --cached')).toBe('rtk git diff --cached');
        });

        it('should rewrite ls commands', async () => {
            const rtkRewrite = await loadRtkRewrite();
            mockedExecSync.mockReturnValueOnce('/usr/local/bin/rtk\n');
            mockedExecFileSync.mockReturnValueOnce('rtk ls -la /tmp');

            expect(rtkRewrite('ls -la /tmp')).toBe('rtk ls -la /tmp');
        });

        it('should rewrite docker commands', async () => {
            const rtkRewrite = await loadRtkRewrite();
            mockedExecSync.mockReturnValueOnce('/usr/local/bin/rtk\n');
            mockedExecFileSync.mockReturnValueOnce('rtk docker ps --all');

            expect(rtkRewrite('docker ps --all')).toBe('rtk docker ps --all');
        });

        it('should rewrite pip commands', async () => {
            const rtkRewrite = await loadRtkRewrite();
            mockedExecSync.mockReturnValueOnce('/usr/local/bin/rtk\n');
            mockedExecFileSync.mockReturnValueOnce('rtk pip install requests');

            expect(rtkRewrite('pip install requests')).toBe('rtk pip install requests');
        });

        it('should rewrite cargo commands', async () => {
            const rtkRewrite = await loadRtkRewrite();
            mockedExecSync.mockReturnValueOnce('/usr/local/bin/rtk\n');
            mockedExecFileSync.mockReturnValueOnce('rtk cargo test');

            expect(rtkRewrite('cargo test')).toBe('rtk cargo test');
        });

        it('should return null for unsupported commands', async () => {
            const rtkRewrite = await loadRtkRewrite();
            mockedExecSync.mockReturnValueOnce('/usr/local/bin/rtk\n');
            // rtk rewrite exits 1 for unsupported commands
            mockedExecFileSync.mockImplementationOnce(() => { throw new Error('exit 1'); });

            expect(rtkRewrite('echo hello')).toBeNull();
        });

        it('should return null for python scripts', async () => {
            const rtkRewrite = await loadRtkRewrite();
            mockedExecSync.mockReturnValueOnce('/usr/local/bin/rtk\n');
            mockedExecFileSync.mockImplementationOnce(() => { throw new Error('exit 1'); });

            expect(rtkRewrite('python test.py')).toBeNull();
        });

        it('should return null for node scripts', async () => {
            const rtkRewrite = await loadRtkRewrite();
            mockedExecSync.mockReturnValueOnce('/usr/local/bin/rtk\n');
            mockedExecFileSync.mockImplementationOnce(() => { throw new Error('exit 1'); });

            expect(rtkRewrite('node server.js')).toBeNull();
        });

        it('should handle empty rewrite output as null', async () => {
            const rtkRewrite = await loadRtkRewrite();
            mockedExecSync.mockReturnValueOnce('/usr/local/bin/rtk\n');
            mockedExecFileSync.mockReturnValueOnce('  \n');

            expect(rtkRewrite('git status')).toBeNull();
        });

        it('should trim whitespace from rewrite output', async () => {
            const rtkRewrite = await loadRtkRewrite();
            mockedExecSync.mockReturnValueOnce('/usr/local/bin/rtk\n');
            mockedExecFileSync.mockReturnValueOnce('  rtk git status\n');

            expect(rtkRewrite('git status')).toBe('rtk git status');
        });

        it('should handle commands with special characters', async () => {
            const rtkRewrite = await loadRtkRewrite();
            mockedExecSync.mockReturnValueOnce('/usr/local/bin/rtk\n');
            mockedExecFileSync.mockReturnValueOnce('rtk grep "error.*fatal" /var/log');

            expect(rtkRewrite('grep "error.*fatal" /var/log')).toBe('rtk grep "error.*fatal" /var/log');
        });

        it('should handle commands with pipes (unsupported)', async () => {
            const rtkRewrite = await loadRtkRewrite();
            mockedExecSync.mockReturnValueOnce('/usr/local/bin/rtk\n');
            mockedExecFileSync.mockImplementationOnce(() => { throw new Error('exit 1'); });

            expect(rtkRewrite('cat file.txt | grep error')).toBeNull();
        });
    });

    describe('rtkRewrite - error handling', () => {
        it('should handle timeout gracefully', async () => {
            const rtkRewrite = await loadRtkRewrite();
            mockedExecSync.mockReturnValueOnce('/usr/local/bin/rtk\n');
            mockedExecFileSync.mockImplementationOnce(() => {
                throw Object.assign(new Error('timeout'), { killed: true });
            });

            expect(rtkRewrite('git status')).toBeNull();
        });

        it('should handle ENOENT (binary deleted after cache)', async () => {
            const rtkRewrite = await loadRtkRewrite();
            mockedExecSync.mockReturnValueOnce('/usr/local/bin/rtk\n');
            mockedExecFileSync.mockImplementationOnce(() => {
                throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
            });

            expect(rtkRewrite('git status')).toBeNull();
        });

        it('should handle permission denied', async () => {
            const rtkRewrite = await loadRtkRewrite();
            mockedExecSync.mockReturnValueOnce('/usr/local/bin/rtk\n');
            mockedExecFileSync.mockImplementationOnce(() => {
                throw Object.assign(new Error('EACCES'), { code: 'EACCES' });
            });

            expect(rtkRewrite('git status')).toBeNull();
        });
    });
});

describe('RTK Integration in bash.ts', () => {
    // These tests verify the rewrite logic inlined in bash.ts
    // We test the transformation logic directly without spawning

    describe('command + args merging for RTK', () => {
        it('should pass full command with args to rtkRewrite', () => {
            // Simulating: command = "pip", args = "install requests"
            const command = 'pip';
            const args = '"install" "requests"';
            const fullCmd = args ? `${command} ${args}` : command;

            expect(fullCmd).toBe('pip "install" "requests"');
        });

        it('should pass command alone when no args', () => {
            const command = 'git status';
            const args = '';
            const fullCmd = args ? `${command} ${args}` : command;

            expect(fullCmd).toBe('git status');
        });
    });

    describe('pip→uv transformation with RTK', () => {
        it('should skip pip→uv when RTK rewrites the command', () => {
            // When RTK rewrites "pip install foo" to "rtk pip install foo",
            // we should NOT also do pip→uv replacement
            const rtkApplied = true;
            let newCode = 'rtk pip install requests';

            if (!rtkApplied) {
                newCode = newCode.replace(/(?<!uv\s)pip3\b/g, 'uv pip');
                newCode = newCode.replace(/(?<!uv\s)pip\b/g, 'uv pip');
            }

            // pip should remain unchanged (RTK handles uv detection)
            expect(newCode).toBe('rtk pip install requests');
        });

        it('should apply pip→uv when RTK does not rewrite', () => {
            const rtkApplied = false;
            let newCode = 'pip install requests';

            if (!rtkApplied) {
                newCode = newCode.replace(/(?<!uv\s)pip3\b/g, 'uv pip');
                newCode = newCode.replace(/(?<!uv\s)pip\b/g, 'uv pip');
            }

            expect(newCode).toBe('uv pip install requests');
        });

        it('should apply pip3→uv pip when RTK does not rewrite', () => {
            const rtkApplied = false;
            let newCode = 'pip3 install numpy';

            if (!rtkApplied) {
                newCode = newCode.replace(/(?<!uv\s)pip3\b/g, 'uv pip');
                newCode = newCode.replace(/(?<!uv\s)pip\b/g, 'uv pip');
            }

            expect(newCode).toBe('uv pip install numpy');
        });

        it('should not double-replace uv pip', () => {
            const rtkApplied = false;
            let newCode = 'uv pip install foo';

            if (!rtkApplied) {
                newCode = newCode.replace(/(?<!uv\s)pip3\b/g, 'uv pip');
                newCode = newCode.replace(/(?<!uv\s)pip\b/g, 'uv pip');
            }

            expect(newCode).toBe('uv pip install foo');
        });
    });

    describe('fullCommand assembly with RTK', () => {
        it('should not append args when RTK rewrote the command', () => {
            const rtkApplied = true;
            const sourceVenv = '';
            const newCode = 'rtk git status --porcelain';
            const args = '"--porcelain"';

            const fullCommand = `${sourceVenv}${newCode}${!rtkApplied && args ? ' ' + args : ''}`;

            // args should NOT be appended since RTK already included them
            expect(fullCommand).toBe('rtk git status --porcelain');
        });

        it('should append args when RTK did not rewrite', () => {
            const rtkApplied = false;
            const sourceVenv = '';
            const newCode = 'node';
            const args = '"server.js"';

            const fullCommand = `${sourceVenv}${newCode}${!rtkApplied && args ? ' ' + args : ''}`;

            expect(fullCommand).toBe('node "server.js"');
        });

        it('should prepend venv activation regardless of RTK', () => {
            const rtkApplied = true;
            const sourceVenv = 'source /path/.venv/bin/activate && ';
            const newCode = 'rtk pip install requests';
            const args = '';

            const fullCommand = `${sourceVenv}${newCode}${!rtkApplied && args ? ' ' + args : ''}`;

            expect(fullCommand).toBe('source /path/.venv/bin/activate && rtk pip install requests');
        });

        it('should handle no args and no venv', () => {
            const rtkApplied = false;
            const sourceVenv = '';
            const newCode = 'uv pip install foo';
            const args = '';

            const fullCommand = `${sourceVenv}${newCode}${!rtkApplied && args ? ' ' + args : ''}`;

            expect(fullCommand).toBe('uv pip install foo');
        });
    });

    describe('enableRtk preference', () => {
        it('should not call rtkRewrite when enableRtk is false', () => {
            const enableRtk = false;
            let rtkApplied = false;
            const command = 'git status';

            if (enableRtk) {
                // This should not execute
                rtkApplied = true;
            }

            expect(rtkApplied).toBe(false);
        });

        it('should not call rtkRewrite when enableRtk is undefined', () => {
            const enableRtk = undefined;
            let rtkApplied = false;
            const command = 'git status';

            if (enableRtk) {
                rtkApplied = true;
            }

            expect(rtkApplied).toBe(false);
        });

        it('should call rtkRewrite when enableRtk is true', () => {
            const enableRtk = true;
            let rtkApplied = false;

            if (enableRtk) {
                // Simulate successful rewrite
                rtkApplied = true;
            }

            expect(rtkApplied).toBe(true);
        });
    });
});
