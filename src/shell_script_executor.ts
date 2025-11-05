import { Action, RequestOptions, res, getPythonEnv, getProjectEnv, BaseChatMessage, Alert, EnconvoResponse, Runtime } from '@enconvo/api';
import { spawn } from 'child_process';
import fsPromises from 'fs/promises'

interface Options extends RequestOptions {
    shell_script: string,
    args: string,
    cwd?: string,
    need_run_in_background?: boolean
    background_timeout?: number
    functionality_description?: string
    execute_permission?: {
        value: 'always_allow' | 'always_ask' | 'ask_for_special_operation'
    }
}

export default async function main(request: Request): Promise<EnconvoResponse> {
    const options: Options = await request.json();

    let shell_script = options.shell_script.trim()
    if (!shell_script || shell_script.length <= 0) {
        shell_script = options.input_text || ''
    }


    let isAskForSpecialOperation = false;
    if (options.execute_permission?.value === 'ask_for_special_operation') {
        // Split the shell_script by '&&' to handle multiple commands
        const commands = shell_script.split('&&').map(cmd => cmd.trim());
        // Check if any command contains 'rm' or 'mv'
        isAskForSpecialOperation = commands.some(cmd => cmd.includes('rm') || cmd.includes('mv'));
    }

    const isAlwaysAsk = options.execute_permission?.value === 'always_ask'
    if (isAskForSpecialOperation || isAlwaysAsk) {

        const alert = await Alert.show({
            title: 'Are you sure you want to run the shell script?',
            message: `${shell_script}`,
            confirm_button_text: 'Run',
            cancel_button_text: 'Cancel'
        })

        if (alert === 'cancel') {
            return EnconvoResponse.messages([
                BaseChatMessage.assistant([
                    {
                        type: 'text',
                        text: 'User canceled the running of the shell script'
                    }
                ])
            ])
        }
    }


    if (shell_script === 'npm run dev' || shell_script === 'npm start' || shell_script === 'npm run start' || shell_script.includes('python -m http.server') || shell_script.includes('python3 -m http.server')) {
        options.need_run_in_background = true
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
    const shellFilePath = `${projectPath}/.temp_script.sh`;
    console.log('shellFilePath', shellFilePath);
    await fsPromises.writeFile(shellFilePath, newCode);
    console.log('writeFile success');
    const result = await new Promise<{ code: number, output: string }>((resolve, reject) => {
        /**
         * set shell
         */
        const shell = process.env.SHELL || '/bin/bash'
        const command = `${sourceVenv} ${shell} '${shellFilePath}' ${args}`;
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
            if (options.need_run_in_background) {
                timer = setTimeout(() => {
                    console.log('run success');
                    resolve({
                        code: 0,
                        output
                    });
                }, options.background_timeout || 1000 * 10);
            } else {
                timer = setTimeout(() => {
                    console.log('run success');
                    resolve({
                        code: 0,
                        output
                    });
                }, options.background_timeout || 1000 * 10);
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

    const finalResult = resultStr || ''

    if (!Runtime.isInteractiveMode()) {
        return EnconvoResponse.json({
            result: finalResult
        })
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
}
