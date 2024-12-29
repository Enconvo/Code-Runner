import { Action, EnconvoResponse, environment, Extension, RequestOptions, res } from '@enconvo/api';
import { execSync, spawn } from 'child_process';
import fs from "fs"
import { getPythonEnv } from './python_util.ts';

interface Options extends RequestOptions {
    python_code: string,
    python_interpreter: {
        title: string,
        value: string
    } | string,
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


    const venvPath = getPythonEnv(options)

    // 将所有命令组合在一起，在同一个 bash 进程中执行
    const command = `source bin/activate && python -c "${newCode}"`;

    const child = spawn('/bin/bash', ['-c', command], {
        cwd: venvPath,
        env: process.env
    });

    let output = '';
    child.stdout.on('data', async (data) => {
        const chunk = data.toString();
        console.log(chunk);

        await res.write({
            content: chunk,
            action: res.WriteAction.AppendToLastMessageLastTextContent
        })
        output += chunk;
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

    const result = await new Promise<Buffer>((resolve, reject) => {
        child.on('close', (code) => {
            if (code === 0) {
                resolve(Buffer.from(output));
            } else {
                reject(new Error(`Process exited with code ${code}`));
            }
        });
    });

    const resultStr = result.toString()

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
