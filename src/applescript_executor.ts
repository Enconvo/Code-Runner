import { EnconvoResponse, RequestOptions } from '@enconvo/api';
import { execFileSync } from 'child_process';

interface Options extends RequestOptions {
    applescript: string,
    args: string,
}

export default async function main(request: Request): Promise<EnconvoResponse> {
    const options: Options = await request.json();

    let applescript = options.applescript
    if (!applescript || applescript.length <= 0) {
        applescript = options.input_text || ''
    }

    let argv = (options.args || '').trim().split(' ').filter(arg => arg)

    if (argv.length <= 0) {
        argv = options.applescript ? [
            options.input_text || ''
        ] : []
    }

    const args = argv.map(arg => `"${arg}"`).join(' ').trim()

    const newCode = `${applescript} ${args}`
    console.log('newCode', newCode);

    const result = execFileSync('osascript', ['-e', newCode], {
        env: process.env
    });

    console.log('result', result.toString());
    return result.toString();
}
