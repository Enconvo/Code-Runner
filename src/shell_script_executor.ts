import { Response, Action, RequestOptions, res, getPythonEnv, getProjectEnv } from '@enconvo/api';
import { execSync, spawn } from 'child_process';
import fs from "fs"
import { homedir } from 'os';
import { getArchitecture } from './utils/arch_util.ts';

interface Options extends RequestOptions {
    shell_script: string,
    args: string,
    cwd?: string,
}

export default async function main(request: Request): Promise<Response> {
    const options: Options = await request.json();
    console.log("sessionId", options.session_id)

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
    const venvPath = await getPythonEnv({
        cwd: options.cwd
    })

    console.log('venvPath1', venvPath);
    let sourceVenv = ''
    if (venvPath) {
        sourceVenv = `source ${venvPath}/bin/activate && `
    }

    /**
     * set project path
     */
    const projectPath = getProjectEnv()

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
        const arch = getArchitecture()
        const nodePath = `${homedir()}/.config/enconvo/preload/node/${arch}/bin`
        process.env.PATH = `${nodePath}:${process.env.PATH}`
    }


    const command = `${exportPath} ${sourceVenv} ${shell} '${shellFilePath}' ${args}`;
    console.log('command', command);

    const child = spawn("/bin/bash", ['-c', command], {
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

    const finalResult = resultStr || ''
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
