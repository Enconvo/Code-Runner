import { execFileSync, execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import os from 'os';
import path from 'path';

const ENCONVO_BIN_DIR = `${os.homedir()}/.config/enconvo/bin`;

let rtkPath: string | null | undefined = undefined; // undefined = not checked yet

/**
 * Find rtk binary path, auto-install if not found.
 * Returns the path to rtk, or null if unavailable.
 */
export function getRtkPath(): string | null {
    if (rtkPath !== undefined) return rtkPath;

    const enconvoBin = path.join(ENCONVO_BIN_DIR, 'rtk');

    // 1. Check enconvo bin dir
    if (existsSync(enconvoBin)) {
        try {
            execFileSync(enconvoBin, ['--version'], { stdio: 'ignore', timeout: 5000 });
            rtkPath = enconvoBin;
            return rtkPath;
        } catch {
            // binary exists but broken
        }
    }

    // 2. Check common locations
    const candidates = [
        `${process.env.HOME}/.local/bin/rtk`,
        '/opt/homebrew/bin/rtk',
        '/usr/local/bin/rtk',
    ];
    for (const p of candidates) {
        if (existsSync(p)) {
            try {
                execFileSync(p, ['--version'], { stdio: 'ignore', timeout: 5000 });
                rtkPath = p;
                return rtkPath;
            } catch {
                // broken
            }
        }
    }

    // 3. Check PATH
    try {
        const found = execSync('which rtk', { encoding: 'utf-8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
        if (found) {
            rtkPath = found;
            return rtkPath;
        }
    } catch {
        // not found
    }

    // 4. Auto-install into enconvo bin dir
    try {
        console.log('RTK not found, installing...');
        mkdirSync(ENCONVO_BIN_DIR, { recursive: true });
        execSync(`curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | RTK_INSTALL_DIR="${ENCONVO_BIN_DIR}" sh`, {
            timeout: 60000,
            stdio: ['ignore', 'pipe', 'pipe']
        });
        // Verify installation
        execFileSync(enconvoBin, ['--version'], { stdio: 'ignore', timeout: 5000 });
        rtkPath = enconvoBin;
        console.log('RTK installed successfully at:', enconvoBin);
        return rtkPath;
    } catch (e) {
        console.log('RTK auto-install failed:', e);
        rtkPath = null;
        return null;
    }
}

/**
 * Try to rewrite a command using `rtk rewrite`.
 * Returns the rewritten command if RTK supports it, or null if not.
 */
export function rtkRewrite(command: string): string | null {
    const binary = getRtkPath();
    if (!binary) return null;
    try {
        const result = execFileSync(binary, ['rewrite', command], {
            encoding: 'utf-8',
            timeout: 5000,
            stdio: ['ignore', 'pipe', 'ignore']
        });
        return result.trim() || null;
    } catch {
        // Exit code 1 means no RTK equivalent
        return null;
    }
}
