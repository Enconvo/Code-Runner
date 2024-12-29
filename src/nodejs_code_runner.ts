import { Action, EnconvoResponse, RequestOptions, res } from '@enconvo/api';
import { spawn } from 'child_process';
import { getProjectEnv } from './utils/env_util.ts';

interface Options extends RequestOptions {
    nodejs_code: string,
    args: string,
}

export default async function main(request: Request): Promise<EnconvoResponse> {
    const options: Options = await request.json();

    let nodejs_code = options.nodejs_code
    if (!nodejs_code || nodejs_code.length <= 0) {
        nodejs_code = options.input_text || ''
    }

    let argv = (options.args || '').trim().split(' ').filter(arg => arg)

    if (argv.length <= 0) {
        argv = options.nodejs_code ? [
            options.input_text || ''
        ] : []
    }

    const args = argv.filter(arg => arg && arg.trim().length > 0).map(arg => `"${arg}"`).join(' ').trim()

    let newCode = `${nodejs_code} ${args}`
    console.log('newCode', newCode);


    // 将所有命令组合在一起，在同一个 bash 进程中执行
    const command = `node -e "${newCode}"`;

    const projectPath = getProjectEnv(options)

    const child = spawn('/bin/bash', ['-c', command], {
        cwd: projectPath,
        env: process.env
    });

    let output = '';
    child.stdout.on('data', async (data) => {
        const chunk = data.toString();
        output += chunk;

        res.write({
            content: chunk,
            action: res.WriteAction.AppendToLastMessageLastTextContent
        })
    });

    child.stderr.on('data', (data) => {
        const chunk = data.toString();
        res.write({
            content: chunk,
            action: res.WriteAction.AppendToLastMessageLastTextContent
        })
        console.error(chunk);
        output += chunk;
    });

    const result = await new Promise<{ code: number, output: string }>((resolve, reject) => {
        child.on('close', (code) => {
            resolve({
                code: code || 0,
                output
            });
        });
    });

    const resultStr = result.output

    const finalResult = resultStr || 'Shell Script Executed without any error'

    return {
        type: "text",
        content: finalResult,
        actions: [
            Action.Paste({ content: finalResult }),
            Action.Copy({ content: finalResult })
        ]
    }
}