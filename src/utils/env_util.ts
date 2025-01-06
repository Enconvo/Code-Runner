import { Extension, RequestOptions } from "@enconvo/api"
import { execSync } from 'child_process';
import fs from "fs"


export function getProjectEnv(options: RequestOptions) {
    let extensionName = options.extensionName || ''
    if (options.runType === "agent") {
        extensionName = options.agentExtensionName || ''
    } else if (options.runType === "flow") {
        extensionName = options.flowExtensionName || ''
    }

    let commandName = options.commandName || ''
    if (options.runType === "agent") {
        commandName = options.agentCommandName || ''
    } else if (options.runType === "flow") {
        commandName = options.flowCommandName || ''
    } else {
        commandName = 'python_code_runner'
    }

    const cachePath = Extension.getCommandCachePath(extensionName || '', commandName || '')

    const projectPath = `${cachePath}/project`

    if (!fs.existsSync(projectPath)) {
        fs.mkdirSync(projectPath, { recursive: true })
    }

    return projectPath
}

export function getPythonEnv(options: RequestOptions) {

    let extensionName = options.extensionName || ''

    if (options.runType === "agent") {
        extensionName = options.agentExtensionName || ''
    } else if (options.runType === "flow") {
        extensionName = options.flowExtensionName || ''
    } else {
        extensionName = options.extensionName || ''
    }

    let commandName = options.commandName || ''
    if (options.runType === "agent") {
        commandName = options.agentCommandName || ''
    } else if (options.runType === "flow") {
        commandName = options.flowCommandName || ''
    } else {
        commandName = 'python_code_runner'
    }

    const cachePath = Extension.getCommandCachePath(extensionName || '', commandName || '')

    const venvPath = `${cachePath}/venv`

    // // Check if the venv directory exists
    if (!fs.existsSync(venvPath)) {
        const newCode = `python -m venv venv`
        const command = `/bin/bash -c "${newCode}"`;
        try {
            const result = execSync(command, {
                shell: '/bin/bash',
                cwd: cachePath,
                env: process.env
            });
            const resultStr = result.toString()
            console.log('resultStr', resultStr);
        } catch (error) {
            console.log('error', error)
            return undefined
        }
    }

    console.log('venvPath', venvPath);
    return venvPath
}