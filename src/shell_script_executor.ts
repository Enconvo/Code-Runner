import { EnconvoResponse, RequestOptions } from '@enconvo/api';
import { execFileSync, execSync } from 'child_process';

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

    const args = argv.filter(arg => arg && arg.trim().length > 0).map(arg => `"${arg}"`).join(' ').trim()

    const newCode = `${shell_script} ${args}`
    console.log('newCode', newCode);

    const venvPath = '/Users/ysnows/.config/enconvo/extension/node_modules/@enconvo/server/hello';

    // 将所有命令组合在一起，在同一个 bash 进程中执行
    const command = `source bin/activate && /bin/bash -c "${newCode}"`;
    const result = execSync(command, {
        shell: '/bin/bash',
        cwd: venvPath,
        env: process.env
    });

    const resultStr = result.toString()
    return resultStr || 'Shell Script Executed without any error';
}
