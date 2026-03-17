import { execFileSync, execSync } from 'child_process';

let rtkPath: string | null | undefined = undefined; // undefined = not checked yet

/**
 * Find rtk binary path, auto-install if not found.
 * Returns the path to rtk, or null if unavailable.
 */
function getRtkPath(): string | null {
    if (rtkPath !== undefined) return rtkPath;
    try {
        // Check if rtk is already on PATH
        const found = execSync('which rtk', { encoding: 'utf-8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
        if (found) {
            rtkPath = found;
            return rtkPath;
        }
    } catch {
        // not found on PATH
    }

    // Check common install location
    const localBin = `${process.env.HOME}/.local/bin/rtk`;
    try {
        execFileSync(localBin, ['--version'], { stdio: 'ignore', timeout: 5000 });
        rtkPath = localBin;
        return rtkPath;
    } catch {
        // not there either
    }

    // Auto-install via official script
    try {
        console.log('RTK not found, installing...');
        execSync('curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh', {
            timeout: 60000,
            stdio: ['ignore', 'pipe', 'pipe']
        });
        // Verify installation
        execFileSync(localBin, ['--version'], { stdio: 'ignore', timeout: 5000 });
        rtkPath = localBin;
        console.log('RTK installed successfully');
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
