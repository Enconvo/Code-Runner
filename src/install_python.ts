import { EnconvoResponse } from '@enconvo/api';
import { exec, execSync } from 'child_process';
import { promisify } from 'util';


export default async function main(): Promise<EnconvoResponse> {

    const miniconda_path = '~/.config/enconvo/preload/miniconda'

    execSync(`mkdir -p ${miniconda_path}`);

    console.log(`downloading to miniconda_path: ${miniconda_path}`);

    const { stdout: downloadOutput } = await promisify(exec)(`curl https://repo.anaconda.com/miniconda/Miniconda3-latest-MacOSX-arm64.sh -o ${miniconda_path}/miniconda.sh`, {
        shell: '/bin/bash'
    });

    console.log(downloadOutput);

    const execPromise = promisify(exec);
    const { stdout, stderr } = await execPromise(`/bin/bash ${miniconda_path}/miniconda.sh -b -u -p ${miniconda_path}`);
    if (stderr) {
        console.error(`stderr: ${stderr}`);
    }
    console.log(`stdout: ${stdout}`);

    execSync(`rm ${miniconda_path}/miniconda.sh`);

    return "Miniconda installed successfully";

}
