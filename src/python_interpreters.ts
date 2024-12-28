import { DropdownListCache } from "@enconvo/api"
import { exec } from 'child_process';
import { promisify } from 'util';
const execPromise = promisify(exec);

const models: DropdownListCache.ModelOutput[] = [
    {
        "title": "Gemini 2.0 Flash Exp",
        "value": "gemini-2.0-flash-exp",
        "context": 1048576,
        "visionEnable": true
    },
    {
        "title": "Gemini 2.0 Flash Thinking",
        "value": "gemini-2.0-flash-thinking-exp-1219",
        "context": 1048576,
        "visionEnable": true
    },
    {
        "title": "Gemini Exp 1206",
        "value": "gemini-exp-1206",
        "context": 1048576,
        "visionEnable": true
    },
    {
        "title": "Gemini 1.5 Flash-8B",
        "value": "gemini-1.5-flash-8b",
        "context": 1048576,
        "visionEnable": true
    },
    {
        "title": "Gemini 1.5 Flash 002",
        "value": "gemini-1.5-flash-002",
        "context": 1048576,
        "visionEnable": true
    },
    {
        "title": "Gemini 1.5 Pro 002",
        "value": "gemini-1.5-pro-002",
        "context": 2097152,
        "visionEnable": true
    }
]

/**
 * Fetches models from the API and transforms them into ModelOutput format
 * @param url - API endpoint URL
 * @param api_key - API authentication key
 * @returns Promise<ModelOutput[]> - Array of processed model data
 */
async function fetchModels(url: string, api_key: string, type: string): Promise<DropdownListCache.ModelOutput[]> {
    // console.log("fetchModels", url, api_key, type)
    try {

        return models
    } catch (error) {
        console.error('Error fetching models:', error)
        return []
    }
}

async function findPythonInterpreters(): Promise<Array<{version: string, path: string, name?: string}>> {
    const commonPaths = [
        '/usr/bin/python3',
        '/usr/local/bin/python3',
        '/opt/homebrew/bin/python3',
        '/opt/homebrew/bin/python3.10',
        '/opt/homebrew/bin/python3.11',
        '/opt/homebrew/bin/python3.12',
        '/var/miniconda3/bin/python',
        '~/Library/Application Support/pypoetry/venv/bin/python'
    ];

    const interpreters: Array<{version: string, path: string, name?: string}> = [];

    try {
        // Run command to get Python version for each path
        for (const path of commonPaths) {
            try {
                const { stdout } = await execPromise(`${path} --version`);
                const version = stdout.trim().replace('Python ', '');
                interpreters.push({
                    version,
                    path,
                });
            } catch (error) {
                // Skip if Python not found at this path
                continue;
            }
        }

        // Check for conda environments
        try {
            const { stdout: condaList } = await execPromise('conda env list');
            const envLines = condaList.split('\n').slice(2); // Skip header lines
            
            for (const line of envLines) {
                if (line.trim()) {
                    const [name, path] = line.trim().split(/\s+/);
                    if (path) {
                        const pythonPath = `${path}/bin/python`;
                        try {
                            const { stdout } = await execPromise(`${pythonPath} --version`);
                            const version = stdout.trim().replace('Python ', '');
                            interpreters.push({
                                version,
                                path: pythonPath,
                                name: `conda:${name}`
                            });
                        } catch (error) {
                            continue;
                        }
                    }
                }
            }
        } catch (error) {
            // Conda not installed, skip
        }

        return interpreters;
    } catch (error) {
        console.error('Error finding Python interpreters:', error);
        return [];
    }
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
        ...options,
        input_text: 'refresh'
    })
    
    return JSON.stringify(models)
}
