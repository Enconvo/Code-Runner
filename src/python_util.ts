import { Extension, RequestOptions } from "@enconvo/api"
import { execSync } from 'child_process';
import fs from "fs"

export function getPythonEnv(options: RequestOptions) {

    let extensionName = options.extensionName || ''
    if (options.runType === "agent") {
        extensionName = options.agent_extension_name || ''
    }
    let commandName = options.commandName || ''
    if (options.runType === "agent") {
        commandName = options.agent_command_name || ''
    }

    const cachePath = Extension.getCommandCachePath(extensionName || '', commandName || '')
    console.log('cachePath', cachePath);

    const venvPath = `${cachePath}/venv`

    // // Check if the venv directory exists
    if (!fs.existsSync(venvPath)) {
        const newCode = `python -m venv venv`
        const command = `/bin/bash -c "${newCode}"`;
        const result = execSync(command, {
            shell: '/bin/bash',
            cwd: cachePath,
            env: process.env
        });

        const resultStr = result.toString()
        console.log('resultStr', resultStr);
    }

    console.log('venvPath', venvPath);
    return venvPath
}