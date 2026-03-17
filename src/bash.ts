import { Action, RequestOptions, getPythonEnv, getProjectEnv, BaseChatMessage, EnconvoResponse, Runtime, FileUtil, res } from '@enconvo/api';
import { exec, execSync, spawn } from 'child_process';
import { rtkRewrite } from './utils/rtk_util.js';

const DEFAULT_TIMEOUT = 2 * 60 * 1000;

interface Options extends RequestOptions {
    command: string,
    args: string,
    workDir?: string,
    run_in_background?: boolean,
    timeout?: number,
    enableRtk?: boolean
}


export default async function main(request: Request): Promise<EnconvoResponse> {
    try {

        const options: Options = await request.json();
        // console.log("running shell script executor1", JSON.stringify(options, null, 2));

        let command = options.command
        if (!command || command.length <= 0) {
            command = options.input_text || ''
        }
        console.log("running shell script executor2", options.params?.tool_call_id);

        let argv = (options.args || '').trim().split(' ').filter(arg => arg)

        if (argv.length <= 0) {
            argv = options.command ? [
                options.input_text || ''
            ] : []
        }

        console.log("running shell script executor2", options.params?.tool_call_id);
        const args = argv.filter(arg => arg && arg.trim().length > 0).map(arg => `"${arg}"`).join(' ').trim()


        let newCode = `${command}`

        // Try RTK rewrite for token-optimized output
        let rtkApplied = false
        if (options.enableRtk) {
            const fullCmd = args ? `${newCode} ${args}` : newCode
            const rewritten = rtkRewrite(fullCmd)
            if (rewritten) {
                newCode = rewritten
                rtkApplied = true
                console.log('RTK rewrote command:', fullCmd, '->', rewritten)
            }
        }

        // Replace pip/pip3 with uv pip (skip if RTK handled the command,
        // since RTK's pip module auto-detects uv)
        if (!rtkApplied) {
            newCode = newCode.replace(/(?<!uv\s)pip3\b/g, 'uv pip');
            newCode = newCode.replace(/(?<!uv\s)pip\b/g, 'uv pip');
        }

        console.log('newCode', newCode);

        /**
         * set venv
         */
        const venvPath = await getPythonEnv({
            cwd: options.workDir
        })

        console.log('venvPath2', venvPath);
        let sourceVenv = ''
        console.log('venvPath3', venvPath);
        if (venvPath) {
            sourceVenv = `source ${venvPath}/bin/activate && `
        }

        /**
         * set project path
         */
        const projectPath = await getProjectEnv({
            cwd: options.workDir
        })
        console.log('projectPath2', projectPath);
        FileUtil.ensureDirExist(projectPath)


        const shell = process.env.SHELL || '/bin/bash'
        const fullCommand = `${sourceVenv}${newCode}${!rtkApplied && args ? ' ' + args : ''}`;
        console.log('command--', fullCommand);

        const timeout = options.timeout || DEFAULT_TIMEOUT;

        const result = await new Promise<{ code: number, output: string }>((resolve) => {
            const child = spawn(shell, ['-c', fullCommand], {
                cwd: projectPath,
                env: process.env,
                stdio: ['ignore', 'pipe', 'pipe']
            });

            let output = '';
            let resolved = false;

            const doResolve = (code: number) => {
                if (resolved) return;
                resolved = true;
                clearTimeout(timeoutTimer);
                resolve({ code, output });
            };

            const timeoutTimer = setTimeout(() => {
                child.kill();
                doResolve(1);
            }, timeout);

            child.stdout.on('data', (data) => {
                const chunk = data.toString();
                console.log("data:", chunk);
                output += chunk;
                // res.write({
                //     content: chunk,
                //     action: EnconvoResponse.WriteAction.AppendToLastMessageLastTextContent
                // })
            });

            child.stderr.on('data', (data) => {
                const chunk = data.toString();
                console.log("error data:", chunk);
                // res.write({
                //     content: chunk,
                //     action: EnconvoResponse.WriteAction.AppendToLastMessageLastTextContent
                // })
                output += chunk;
            });

            child.on('close', (code) => {
                doResolve(code || 0);
            });
        });

        const resultStr = result.output

        const finalResult = resultStr || ''
        // console.log('finalResult', finalResult)

        if (!Runtime.isInteractiveMode()) {
            try {
                const parsedResult = JSON.parse(finalResult)
                if (parsedResult.type === 'messages' && parsedResult.messages?.length > 0) {
                    return EnconvoResponse.messages(parsedResult.messages)
                }
            } catch (error) {

            }

            return finalResult
        }


        return EnconvoResponse.messages([
            BaseChatMessage.assistant([
                {
                    type: 'text',
                    text: finalResult
                }
            ])
        ], [Action.Paste({ content: finalResult }),
        Action.Copy({ content: finalResult })])

    } catch (error) {
        console.log('bash', error)

        //@ts-ignore
        return EnconvoResponse.error(error?.message || 'error')
    }
}
