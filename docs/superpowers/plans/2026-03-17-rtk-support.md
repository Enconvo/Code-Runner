# RTK (Rust Token Killer) Support Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate RTK into code_runner so shell commands are automatically compressed to reduce LLM token consumption.

**Architecture:** Before executing a shell command, check if `rtk` is installed and use `rtk rewrite <command>` to get a token-optimized version. RTK is a Rust binary with <10ms overhead. When RTK handles a command, skip the manual `pip→uv` transformation since RTK's `pip` module auto-detects uv. Add a command-level preference to enable/disable RTK.

**Tech Stack:** TypeScript, Node.js `child_process.execFileSync`, `@enconvo/api`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/utils/rtk_util.ts` | Create | RTK detection + command rewriting |
| `src/bash.ts` | Modify | Integrate RTK rewrite before command execution |
| `package.json` | Modify | Add `enableRtk` preference to bash command |

---

### Task 1: Create RTK utility module

**Files:**
- Create: `src/utils/rtk_util.ts`

- [ ] **Step 1: Create `src/utils/rtk_util.ts`**

```typescript
import { execFileSync } from 'child_process';

// Cached for worker lifetime; restart worker if rtk is newly installed
let rtkAvailable: boolean | null = null;

/**
 * Check if rtk binary is available on PATH. Result is cached.
 */
function isRtkInstalled(): boolean {
    if (rtkAvailable !== null) return rtkAvailable;
    try {
        execFileSync('rtk', ['--version'], { stdio: 'ignore', timeout: 5000 });
        rtkAvailable = true;
    } catch {
        rtkAvailable = false;
    }
    return rtkAvailable;
}

/**
 * Try to rewrite a command using `rtk rewrite`.
 * Returns the rewritten command if RTK supports it, or null if not.
 * RTK rewrite accepts the full command as a single string argument.
 */
export function rtkRewrite(command: string): string | null {
    if (!isRtkInstalled()) return null;
    try {
        const result = execFileSync('rtk', ['rewrite', command], {
            encoding: 'utf-8',
            timeout: 5000,
            stdio: ['ignore', 'pipe', 'ignore']
        });
        return result.trim() || null;
    } catch {
        // Exit code 1 means no RTK equivalent — fall through
        return null;
    }
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd /Users/ysnows/Documents/Enconvo-AI/modules/code_runner && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/utils/rtk_util.ts
git commit -m "feat: add RTK utility for command rewriting"
```

---

### Task 2: Add RTK preference to package.json

**Files:**
- Modify: `package.json` — add `enableRtk` preference to the `bash` command

- [ ] **Step 1: Add `enableRtk` preference**

In `package.json`, add a `"preferences"` array inside `commands[0]` (the bash command), after the `"parameters"` field:

```json
"preferences": [
    {
        "name": "enableRtk",
        "title": "Enable RTK",
        "description": "Use RTK (Rust Token Killer) to compress command output and reduce token usage. Requires rtk to be installed (brew install rtk).",
        "type": "checkbox",
        "default": false,
        "label": "Enable RTK token optimization"
    }
]
```

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "feat: add RTK enable/disable preference"
```

---

### Task 3: Integrate RTK rewrite into bash.ts

**Files:**
- Modify: `src/bash.ts:1` — add import
- Modify: `src/bash.ts:6-12` — add `enableRtk` to Options interface
- Modify: `src/bash.ts:39-43` — integrate RTK rewrite before pip transformation

- [ ] **Step 1: Add import at top of `src/bash.ts`**

After the existing import line (line 2), add:

```typescript
import { rtkRewrite } from './utils/rtk_util.js';
```

- [ ] **Step 2: Add `enableRtk` to Options interface**

Add `enableRtk?: boolean` to the `Options` interface at line 6-12:

```typescript
interface Options extends RequestOptions {
    command: string,
    args: string,
    workDir?: string,
    run_in_background?: boolean,
    timeout?: number,
    enableRtk?: boolean
}
```

- [ ] **Step 3: Add RTK rewrite logic in `src/bash.ts`**

Replace the block at lines 39-43 (the pip replacement logic):

```typescript
// Current code (lines 39-43):
let newCode = `${command}`
// Replace standalone 'pip' and 'pip3' that are NOT preceded by 'uv '
newCode = newCode.replace(/(?<!uv\s)pip3\b/g, 'uv pip');
newCode = newCode.replace(/(?<!uv\s)pip\b/g, 'uv pip');
```

With:

```typescript
let newCode = `${command}`

// Try RTK rewrite for token-optimized output
let rtkApplied = false
if (options.enableRtk) {
    // Include args in rewrite so RTK sees the full command (e.g. "pip install requests")
    const fullCmd = args ? `${newCode} ${args}` : newCode
    const rewritten = rtkRewrite(fullCmd)
    if (rewritten) {
        newCode = rewritten
        rtkApplied = true
        console.log('RTK rewrote command:', fullCmd, '->', rewritten)
    }
}

// Replace pip/pip3 with uv pip (skip if RTK handled the command,
// since RTK's pip module auto-detects uv)
if (!rtkApplied) {
    newCode = newCode.replace(/(?<!uv\s)pip3\b/g, 'uv pip');
    newCode = newCode.replace(/(?<!uv\s)pip\b/g, 'uv pip');
}
```

Also update line 71 to skip appending args when RTK already included them:

```typescript
// Current code (line 71):
const fullCommand = `${sourceVenv}${newCode}${args ? ' ' + args : ''}`;

// New code:
const fullCommand = `${sourceVenv}${newCode}${!rtkApplied && args ? ' ' + args : ''}`;
```

Key logic:
- `options.enableRtk` reads the command-level preference (merged flat into options)
- RTK rewrite includes `args` so it sees the full command (e.g. `pip install requests` not just `pip`)
- If RTK rewrites, args are already embedded in `newCode` — don't append again
- If RTK doesn't support the command (exit 1), fall back to the original pip→uv logic

- [ ] **Step 4: Verify the file compiles**

Run: `cd /Users/ysnows/Documents/Enconvo-AI/modules/code_runner && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Manual test — build the extension**

Run: `cd /Users/ysnows/Documents/Enconvo-AI/modules/code_runner && npx enconvo build`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/bash.ts
git commit -m "feat: integrate RTK command rewriting for token optimization"
```

---

### Task 4: Bump version

**Files:**
- Modify: `package.json:4` — bump version

- [ ] **Step 1: Bump patch version**

Change `"version": "0.0.133"` to `"version": "0.0.134"` in `package.json`.

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "chore: bump version to 0.0.134"
```

---

## Summary of Changes

When `enableRtk` is toggled on in the bash command preferences and `rtk` is installed:
- `rtk rewrite` is called with the full command string before execution
- If RTK supports the command, the rewritten (token-optimized) version is executed instead
- Examples: `git status` → `rtk git status`, `ls -la` → `rtk ls -la`, `docker ps` → `rtk docker ps`
- RTK's `pip` module auto-detects uv, so pip→uv transformation is skipped for RTK-handled commands
- Unsupported commands pass through unchanged with normal pip→uv transformation
- Total overhead: <10ms per command (Rust binary, cached availability check)
