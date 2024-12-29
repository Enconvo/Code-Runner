import { DropdownListCache, environment, Extension } from "@enconvo/api"
import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';

const execPromise = promisify(exec);

interface PythonInterpreter {
    version: string;
    path: string;
    name?: string;
    bits?: string;
}

async function findSystemPythonPaths(): Promise<string[]> {
    try {
        // Get all potential Python paths from common locations
        const { stdout: whichPython3 } = await execPromise('which -a python3 2>/dev/null || true');
        const { stdout: whichPython } = await execPromise('which -a python 2>/dev/null || true');

        // Get Homebrew Python paths
        const { stdout: homebrewPaths } = await execPromise('ls -1 /opt/homebrew/bin/python* 2>/dev/null || true');

        // Get conda environments if conda is installed
        let condaPaths: string[] = [];
        try {
            const { stdout: condaInfo } = await execPromise('conda info --envs 2>/dev/null || true');
            condaPaths = condaInfo
                .split('\n')
                .slice(2) // Skip header lines
                .filter(line => line.trim())
                .map(line => {
                    const [name, path] = line.trim().split(/\s+/);
                    return path ? `${path}/bin/python` : null;
                })
                .filter((path): path is string => path !== null);
        } catch (error) {
            // Conda not installed or not accessible
        }

        // Get poetry environments
        let poetryPaths: string[] = [];
        try {
            const { stdout: poetryEnvs } = await execPromise('poetry env list --full-path 2>/dev/null || true');
            poetryPaths = poetryEnvs
                .split('\n')
                .filter(line => line.trim())
                .map(line => `${line.trim()}/bin/python`);
        } catch (error) {
            // Poetry not installed or not accessible
        }

        // Combine all paths and remove duplicates
        const allPaths = [...new Set([
            ...whichPython3.split('\n'),
            ...whichPython.split('\n'),
            ...homebrewPaths.split('\n'),
            ...condaPaths,
            ...poetryPaths
        ].filter(path => path.trim()))]

        return allPaths;
    } catch (error) {
        console.error('Error finding Python paths:', error);
        return [];
    }
}


export async function findPythonInterpreters(options: { extensionName?: string, commandName?: string }): Promise<PythonInterpreter[]> {
    const interpreters: PythonInterpreter[] = [];

    try {

        let pythonPaths = await findSystemPythonPaths();

        const cachePath = Extension.getCommandCachePath(options.extensionName || '', options.commandName || '')
        const venvPath = `${cachePath}/venv`

        // Check if the venv directory exists
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

        pythonPaths.unshift(`${venvPath}/bin/python`)

        for (const path of pythonPaths) {
            try {
                // Get version and architecture information
                const { stdout: versionOutput } = await execPromise(`${path} -c "import sys, platform; print(sys.version.split()[0] + ' ' + platform.architecture()[0])"`);
                const [version, bits] = versionOutput.trim().split(' ');

                // Try to determine if this is a virtual environment
                let name: string | undefined;
                try {
                    const { stdout: envInfo } = await execPromise(`${path} -c "import sys; print('venv' if hasattr(sys, 'real_prefix') or (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix) else '')"`);
                    if (envInfo.trim() === 'venv') {
                        name = 'venv';
                    }
                } catch (error) {
                    // Unable to determine virtual environment status
                }

                interpreters.push({
                    version,
                    path,
                    name,
                    bits
                });
            } catch (error) {
                // Skip if Python not found at this path or other errors
                continue;
            }
        }

        // Sort interpreters by version number in descending order
        // interpreters.sort((a, b) => {
        //     const versionA = a.version.split('.').map(Number);
        //     const versionB = b.version.split('.').map(Number);

        //     for (let i = 0; i < Math.max(versionA.length, versionB.length); i++) {
        //         const numA = versionA[i] || 0;
        //         const numB = versionB[i] || 0;
        //         if (numA !== numB) {
        //             return numB - numA;
        //         }
        //     }
        //     return 0;
        // });


        return interpreters;
    } catch (error) {
        console.error('Error finding Python interpreters:', error);
        return [];
    }
}

/**
 * Fetches models from the API and transforms them into ModelOutput format
 * @param url - API endpoint URL
 * @param api_key - API authentication key
 * @returns Promise<ModelOutput[]> - Array of processed model data
 */
async function fetchModels(url: string, api_key: string, type: string, extensionName?: string, commandName?: string): Promise<DropdownListCache.ModelOutput[]> {

    try {
        const interpreters = await findPythonInterpreters({ extensionName, commandName })

        const formattedInterpreters = interpreters.map(async interpreter => ({
            title: await formatInterpreterDisplay(interpreter),
            value: interpreter.path,
            description: interpreter.path
        }))

        const models = await Promise.all(formattedInterpreters)
        return models

    } catch (error) {
        console.error('Error fetching models:', error)
        return []
    }
}

async function formatInterpreterDisplay(interpreter: PythonInterpreter): Promise<string> {
    const version = interpreter.version;
    const bits = interpreter.bits ? ` ${interpreter.bits}` : '';
    const name = interpreter.name ? ` ('${interpreter.name}')` : '';
    return `Python ${version}${bits}${name} ${interpreter.path}`;
}

/**
 * Main handler function for the API endpoint
 * @param req - Request object containing options
 * @returns Promise<string> - JSON string of model data
 */
export default async function main(req: Request): Promise<string> {
    const options = await req.json()

    const modelCache = new DropdownListCache(fetchModels)

    const models = await modelCache.getModelsCache({
        ...options
    })

    return JSON.stringify(models)
}
