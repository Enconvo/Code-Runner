import { EnconvoResponse, RequestOptions } from '@enconvo/api';
import { execFileSync, execSync } from 'child_process';

interface Options extends RequestOptions {
    python_code: string,
    args: string,
}

export default async function main(request: Request): Promise<EnconvoResponse> {
    const options: Options = await request.json();

    let python_code = options.python_code
    if (!python_code || python_code.length <= 0) {
        python_code = options.input_text || ''
    }

    let argv = (options.args || '').trim().split(' ').filter(arg => arg)

    if (argv.length <= 0) {
        argv = options.python_code ? [
            options.input_text || ''
        ] : []
    }

    const args = argv.filter(arg => arg && arg.trim().length > 0).map(arg => `"${arg}"`).join(' ').trim()

    let newCode = `${python_code} ${args}`
    console.log('newCode', newCode);

    const venvPath = '/Users/ysnows/.config/enconvo/extension/node_modules/@enconvo/server/hello';

    // 将所有命令组合在一起，在同一个 bash 进程中执行
    const command = `source bin/activate && python -c '${newCode}'`;
    const result = execSync(command, {
        shell: '/bin/bash',
        cwd: venvPath,
        env: process.env
    });

    const resultStr = result.toString()
    console.log('result', resultStr);
    return resultStr || 'executed';
}
