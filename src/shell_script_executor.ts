import { Action, EnconvoResponse, RequestOptions, res } from '@enconvo/api';
import { execSync, spawn } from 'child_process';
import { getProjectEnv, getPythonEnv } from './utils/env_util.ts';
import fs from "fs"
import path from 'path';

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

    /**
     * set venv
     */
    const venvPath = await getPythonEnv(options)
    console.log('venvPath1', venvPath);
    let sourceVenv = ''
    if (venvPath) {
        sourceVenv = `source ${venvPath}/bin/activate && `
    }

    /**
     * set project path
     */
    const projectPath = getProjectEnv(options)

    /**
     * write shell script
     */
    const shellFilePath = `${projectPath}/temp_script.sh`;
    fs.writeFileSync(shellFilePath, newCode);

    /**
     * set shell
     */
    const shell = process.env.SHELL || '/bin/bash'

    /**
     * set node path
     */
    let exportPath = 'export PATH="/sbin/:$PATH" &&';
    try {
        execSync('node -v', { stdio: 'ignore' });
    } catch (error) {
        const nodePath = path.dirname(process.env.NODE_PATH!);
        console.log('Setting NODE_PATH:', nodePath, shell);
        exportPath = exportPath + `export PATH="${nodePath}:$PATH" && `;
    }


    const command = `${exportPath} ${sourceVenv} ${shell} '${shellFilePath}' ${args}`;
    console.log('command', command);

    const child = spawn(shell, ['-c', command], {
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
