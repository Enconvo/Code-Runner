import { Action, EnconvoResponse, environment, Extension, RequestOptions, res } from '@enconvo/api';
import { execSync, spawn } from 'child_process';
import fs from "fs"
import { getProjectEnv, getPythonEnv } from './utils/env_util.ts';

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

    const command = `source ${venvPath}/bin/activate && python -c "${newCode}"`;

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
