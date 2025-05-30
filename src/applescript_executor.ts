import { Action, BaseChatMessage, RequestOptions, Response } from '@enconvo/api';
import { execFileSync } from 'child_process';

interface Options extends RequestOptions {
    applescript: string,
    args: string,
}

export default async function main(request: Request): Promise<Response> {
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

    const args = argv.filter(arg => arg && arg.trim().length > 0).map(arg => `"${arg}"`).join(' ').trim()

    const newCode = `${applescript} ${args}`

    const result = execFileSync('osascript', ['-e', `${newCode}`], {
        env: process.env
    });

    const resultStr = result.toString()
    return Response.messages([
        BaseChatMessage.assistant([
            {
                type: 'text',
                text: resultStr || 'AppleScript Executed successfully'
            }
        ])
    ], [Action.Paste({ content: resultStr }),
    Action.Copy({ content: resultStr })])
}
