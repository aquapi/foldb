const fs = require("fs");

fs.unlink("types", () => {});

require("child_process").exec("npx tsc").stderr.on("data", console.log).on("close", () => {
    fs.unlink("types/clearDir.d.ts", () => {});
    fs.unlink("types/match.d.ts", () => {});
});

require("esbuild").build({
    entryPoints: ["./src/index.ts"],
    loader: {
        ".ts": "ts",
    },
    bundle: true,
    outfile: "./index.js",
    platform: "node",
    minify: true,
    legalComments: "none"
});
