import { RequestOptions, Response, getProjectEnv } from '@enconvo/api';
import { execFileSync, execSync } from 'child_process';

interface Options extends RequestOptions {
    code_environment: string | {
        title: string;
        value: string;
    },
    code: string,
    PYTHON_BIN_PATH: string
}

export default async function main(request: Request): Promise<Response> {
    const options: Options = await request.json();
    const code = (options.code || options.input_text || '').trim();

    if (!code.trim()) {
        return 'No code provided';
    }

    const argv = options.code ? [
        options.input_text || '',
        options.context_files || '',
        options.context_screen || '',
        options.context_camera || ''
    ] : [
        options.context_files || '',
        options.context_screen || '',
        options.context_camera || ''
    ];

    const envCommands = {
        zsh: ['/bin/zsh', ['-c', `${code} ${argv.filter(arg => arg).map(arg => `"${arg}"`).join(' ')}`]],
        bash: ['/bin/bash', ['-c', `${code} ${argv.filter(arg => arg).map(arg => `"${arg}"`).join(' ')}`]],
        nodejs: [process.env.NODE_PATH || 'node', ['-e', `
            process.argv.push(...${JSON.stringify(argv.filter(arg => arg))});
            ${code}
        `]],
        python: [options.PYTHON_BIN_PATH, ['-c', `
import sys
sys.argv.extend(${JSON.stringify(argv.filter(arg => arg))})
${code}
        `]],
        applescript: ['osascript', ['-e', `${code} ${argv.filter(arg => arg).map(arg => `"${arg}"`).join(' ')}`]]
    };

    const env = typeof options.code_environment === 'string' ? options.code_environment : options.code_environment.value
    const [cmd, args] = envCommands[env] || []

    console.log(cmd, args)

    if (!cmd) {
        return 'Not supported environment';
    }

    try {
        const result = execFileSync(cmd, args);
        console.log('result', result.toString());
        return result;
    } catch (error) {
        console.error(error);
        // @ts-ignore
        return `Error: ${error.message}`;
    }
}
