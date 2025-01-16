import { Extension, RequestOptions, res } from "@enconvo/api"
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

function isVenvValid(venvPath: string) {

    if (!fs.existsSync(venvPath)) {
        return false
    }

    const pythonBinPath = `${venvPath}/bin/python`;
    if (!fs.existsSync(pythonBinPath)) {
        const originalPath = fs.readlinkSync(pythonBinPath);
        if (!fs.existsSync(originalPath)) {
            console.log('rm -rf ${venvPath}')
            return false
        }
    }
    return true
}


export async function getPythonEnv(options: RequestOptions) {

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
    const projectPath = `${cachePath}/project`

    const venvPath = `${projectPath}/.venv`


    const uv_installed = install_uv()

    // Check if the venv directory exists
    if (isVenvValid(venvPath)) {
        return venvPath
    }

    const newCode = uv_installed ? `uv venv` : `python -m venv .venv`
    const command = ` /bin/bash -c "${newCode}"`;
    try {
        const result = execSync(command, {
            shell: '/bin/bash',
            cwd: projectPath,
            env: process.env
        });
        const resultStr = result.toString()
        console.log('resultStr', resultStr);
    } catch (error) {
        console.log('error1', error)
        return undefined
    }

    return venvPath
}


export function install_uv() {
    try {
        console.log("uv --version", execSync('uv --version').toString());
    } catch (error) {
        // Install uv package manager if not found
        console.log("Installing uv package manager...");
        res.writeLoading('initializing python environment ...');
        try {
            const result = execSync('curl -LsSf https://astral.sh/uv/install.sh | sh', {
                shell: '/bin/bash'
            }).toString()
            console.log("Successfully installed uv", result);
        } catch (err) {
            console.error("Failed to install uv:", err);
            return false
        }
    }
    return true
}