import { Action, RequestOptions, res, getPythonEnv, getProjectEnv, Response } from '@enconvo/api';
import { spawn } from 'child_process';
import fs from "fs"

interface Options extends RequestOptions {
    python_code: string,
    python_interpreter: {
        title: string,
        value: string
    } | string,
    args: string,
}

export default async function main(request: Request): Promise<Response> {
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

    const newCode = `${python_code}`;

    const venvPath = await getPythonEnv();
    const projectPath = getProjectEnv();

    const pythonFilePath = `${projectPath}/temp_script.py`;
    fs.writeFileSync(pythonFilePath, newCode);

    const command = `source ${venvPath}/bin/activate && python ${pythonFilePath} ${args}`;

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
