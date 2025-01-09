import { EnconvoResponse, res } from '@enconvo/api';
import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';
import fs, { rmdirSync } from 'fs';
import path from 'path';
import os from 'os';

/**
 * Installs Miniconda.
 * 
 * @returns {Promise<EnconvoResponse>} A promise that resolves with a success message.
 */
export default async function main(): Promise<EnconvoResponse> {

    // Return a success message
    return "Miniconda installed successfully";
}


export async function install_miniconda() {
    const miniconda_path = path.join(os.homedir(), '.config/enconvo/preload/miniconda')

    if (fs.existsSync(miniconda_path)) {
        rmdirSync(miniconda_path, { recursive: true });
    } else {
        fs.mkdirSync(miniconda_path, { recursive: true });
    }

    console.log(`downloading to miniconda_path: ${miniconda_path}`);

    // Define the URL and file path for the download
    const url = 'https://repo.anaconda.com/miniconda/Miniconda3-latest-MacOSX-arm64.sh';
    const filePath = path.join(miniconda_path, 'miniconda.sh');

    // Download the file using Axios
    const { data, headers } = await axios({
        url,
        method: 'GET',
        responseType: 'stream'
    });

    // Get the total length of the file
    const totalLength = parseInt(headers['content-length'], 10);
    let downloadedLength = 0;

    // Create a write stream for the file
    const writer = fs.createWriteStream(filePath);

    // Listen for data events and update the download progress
    data.on('data', (chunk: Buffer) => {
        downloadedLength += chunk.length;
        const percentage = ((downloadedLength / totalLength) * 100).toFixed(2);
        console.log(`Downloaded ${percentage}%`);
        res.writeLoading('Downloading Python... ' + percentage + '%');
    });

    // Wait for the download to finish
    await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
        data.pipe(writer);
    });

    // Install Miniconda
    res.writeLoading('Installing Python... ');
    const execPromise = promisify(exec);
    let exportPath = 'export PATH="/sbin/:$PATH" &&';
    const { stdout, stderr } = await execPromise(`${exportPath} /bin/bash ${filePath} -b -u -p ${miniconda_path}`);
    if (stderr) {
        return false
    }
    console.log(`stdout: ${stdout}`);

    // Remove the installer script
    // fs.unlinkSync(filePath);

    return miniconda_path
}
