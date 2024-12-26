import { EnconvoResponse, RequestOptions } from '@enconvo/api';
import { execFileSync } from 'child_process';

interface Options extends RequestOptions {
    shell_script: string,
    args: string,
}

export default async function main(request: Request): Promise<EnconvoResponse> {
    const options: Options = await request.json();

    let shell_script = options.shell_script
    if (!shell_script || shell_script.length <= 0) {
        shell_script = options.input_text || ''
    }

    let argv = (options.args || '').trim().split(' ').filter(arg => arg)

    if (argv.length <= 0) {
        argv = options.shell_script ? [
            options.input_text || ''
        ] : []
    }

    const args = argv.map(arg => `"${arg}"`).join(' ').trim()

    const newCode = `${shell_script} ${args}`
    console.log('newCode', newCode);

    const result = execFileSync('/bin/zsh', ['-c', newCode], {
        env: process.env
    });

    console.log('result', result.toString());
    return result.toString();
}
