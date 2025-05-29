import { Response, Action, RequestOptions, res, getPythonEnv, getProjectEnv, FileUtil } from '@enconvo/api';
import { exec, spawn } from 'child_process';
import fsPromises from 'fs/promises'
import { promisify } from 'util';

const execSync = promisify(exec)

interface Options extends RequestOptions {
    port: number,
    working_directory?: string,
}

export default async function main(request: Request): Promise<Response> {
    const options: Options = await request.json();

    const { port, working_directory } = options
    console.log("port", options.port)
    const need_run_in_background = false

    try {
        await execSync(`kill -9 $(lsof -t -i:${port})`)
    } catch (error) {
        console.log("error", error)
    }

    const newCode = `cd ${working_directory} && nohup bash -c "python3 -m http.server ${port} > /dev/null 2>&1 &"`

    /**
     * set venv
     */
    const venvPath = await getPythonEnv()

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
    const shellFilePath = `${projectPath}/.temp_script.sh`;
    console.log('shellFilePath', shellFilePath);
    await fsPromises.writeFile(shellFilePath, newCode);
    console.log('writeFile success');
    const result = await new Promise<{ code: number, output: string }>((resolve, reject) => {
        /**
         * set shell
         */
        const shell = process.env.SHELL || '/bin/bash'
        const command = `${sourceVenv} ${shell} '${shellFilePath}'`;
        console.log('command--', command);

        const child = spawn("/bin/bash", ['-c', command], {
            cwd: projectPath,
            env: process.env
        });

        let output = '';
        let timer: NodeJS.Timeout | null = null;
        child.stdout.on('data', async (data) => {
            timer && clearTimeout(timer);
            const chunk = data.toString();
            console.log("data:", chunk);
            output += chunk;
            if (need_run_in_background) {
                timer = setTimeout(() => {
                    console.log('run success');
                    resolve({
                        code: 0,
                        output
                    });
                }, 1000 * 3);
            } else {
                timer = setTimeout(() => {
                    console.log('run success');
                    resolve({
                        code: 0,
                        output
                    });
                }, 1000 * 3);
            }

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

        child.on('close', (code) => {
            timer && clearTimeout(timer);
            resolve({
                code: code || 0,
                output
            });
        });
    });

    const resultStr = result.output

    const finalResult = resultStr || `The live server is running on port ${port}, you can open it in your browser by clicking the following link: http://localhost:${port}`
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
