import { EnconvoResponse, RequestOptions } from '@enconvo/api';
import { execFileSync } from 'child_process';

interface Options extends RequestOptions {
    code_environment: {
        title: string;
        value: string;
    },
    code: string,
    PYTHON_BIN_PATH: string
}

export default async function main(request: Request): Promise<EnconvoResponse> {
    const options: Options = await request.json();
    const argv1 = options.input_text || ''
    const argv2 = options.selection_text || ''
    const argv3 = options.context_files || ''
    const argv4 = options.context_screen || ''
    const argv5 = options.context_camera || ''

    switch (options.code_environment.value) {
        case 'zsh': {
            let result = execFileSync('/bin/zsh', ['-c', `${options.code} "${argv1}" "${argv2}" "${argv3}" "${argv4}" "${argv5}"`], { encoding: 'utf-8' });
            console.log(result);
            return result;
        }
        case 'bash': {
            let result = execFileSync('/bin/bash', ['-c', `${options.code} "${argv1}" "${argv2}" "${argv3}" "${argv4}" "${argv5}"`], { encoding: 'utf-8' });
            console.log(result);
            return result;
        }
        case 'nodejs': {
            // For Node.js, pass all arguments via process.argv
            let result = execFileSync(
                process.env.NODE_PATH || 'node',
                ['-e', `
                    process.argv[2]="${argv1}";
                    process.argv[3]="${argv2}";
                    process.argv[4]="${argv3}";
                    process.argv[5]="${argv4}";
                    process.argv[6]="${argv5}";
                    ${options.code}
                `],
                { encoding: 'utf-8' }
            );
            console.log(result);
            return result;
        }
        case 'python': {
            // For Python, pass all arguments via sys.argv
            let result = execFileSync(
                options.PYTHON_BIN_PATH,
                ['-c', `import sys
sys.argv.extend(["${argv1}", "${argv2}", "${argv3}", "${argv4}", "${argv5}"])
${options.code}
                `],
                { encoding: 'utf-8' }
            );
            console.log(result);
            return result;
        }
        case 'applescript': {
            let result = execFileSync('osascript', ['-e', `${options.code} "${argv1}" "${argv2}" "${argv3}" "${argv4}" "${argv5}"`], { encoding: 'utf-8' });
            console.log(result);
            return result;
        }
    }

    return 'Not supported environment';
}
