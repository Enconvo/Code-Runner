import { install_miniconda } from "@/install_python.ts";
import { Extension, RequestOptions } from "@enconvo/api"
import { execSync } from 'child_process';
import fs, { unlink, unlinkSync } from "fs"
import os from "os"
import path from "path";


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
            // rm -rf ${venvPath}
            // unlinkSync(venvPath)
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

    const venvPath = `${cachePath}/venv`

    let exportPath = 'export PATH="/sbin/:$PATH" &&';

    try {
        execSync('python --version', { stdio: 'ignore' });
    } catch (error) {
        const miniconda_path = path.join(os.homedir(), '.config/enconvo/preload/miniconda/bin')
        if (fs.existsSync(miniconda_path)) {
            console.log('Setting MINICONDA_PATH:', miniconda_path);
            exportPath = exportPath + `export PATH="${miniconda_path}:$PATH" && `;
        }
    }

    // Check if the venv directory exists
    if (!isVenvValid(venvPath)) {
        const newCode = `python -m venv venv`
        const command = `${exportPath} /bin/bash -c "${newCode}"`;
        try {
            const result = execSync(command, {
                shell: '/bin/bash',
                cwd: cachePath,
                env: process.env
            });
            const resultStr = result.toString()
            console.log('resultStr', resultStr);
        } catch (error) {
            console.log('error1', error)
            const installResult = await install_miniconda()
            if (installResult) {
                try {
                    const result = execSync(command, {
                        shell: '/bin/bash',
                        cwd: cachePath,
                        env: process.env
                    });
                    const resultStr = result.toString()
                    // console.log('resultStr', resultStr);
                } catch (error) {
                    console.log('error2', error)
                    return undefined
                }
            } else {
                return undefined
            }

        }
    }





    return venvPath
}