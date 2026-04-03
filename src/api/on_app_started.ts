import { getRtkPath } from "../utils/rtk_util.ts";

/**
 * Auto-check and install RTK on app startup
 * @private
 */
export default async function main(_request: Request) {
    const rtkPath = getRtkPath();
    if (rtkPath) {
        console.log("RTK ready at:", rtkPath);
        return Response.json({ success: true, path: rtkPath });
    }
    console.log("RTK auto-install failed");
    return Response.json({ success: false });
}
