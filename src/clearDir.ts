import path from "path/posix";
import { readdir, unlink } from "fs/promises";

export = async function clearDir(dir: string) {
    const files = await readdir(dir);
    await Promise.all(files.map(file =>
        unlink(path.join(dir, file))
    ));
}