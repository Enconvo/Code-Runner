import { Action, EnconvoResponse, RequestOptions, res } from '@enconvo/api';
import { spawn } from 'child_process';
import { getProjectEnv, getPythonEnv } from './utils/env_util.ts';
import fs from "fs"

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

    const newCode = `${shell_script}`

    const venvPath = getPythonEnv(options)


    const projectPath = getProjectEnv(options)

    const shellFilePath = `${projectPath}/temp_script.sh`;
    fs.writeFileSync(shellFilePath, newCode);

    const command = `source ${venvPath}/bin/activate && /bin/bash '${shellFilePath}' ${args}`;

    const child = spawn('/bin/bash', ['-c', command], {
        cwd: projectPath,
        env: process.env
    });

    let output = '';
    child.stdout.on('data', async (data) => {
        const chunk = data.toString();
        console.log("data:", chunk);
        output += chunk;

        res.write({
            content: chunk,
            action: res.WriteAction.AppendToLastMessageLastTextContent
        })
    });

    child.stderr.on('data', (data) => {
        const chunk = data.toString();
        console.log("error data:", chunk);
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
    console.log('finalResult', finalResult);
    return {
        type: "text",
        content: finalResult,
        actions: [
            Action.Paste({ content: finalResult }),
            Action.Copy({ content: finalResult })
        ]
    }
}
