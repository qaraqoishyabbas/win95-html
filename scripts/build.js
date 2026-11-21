const { copyFileSync, cpSync, mkdirSync, rmSync } = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "site");

// Only this generated directory is published. Keep the same relative URLs as index.html.
rmSync(output, { recursive: true, force: true });
mkdirSync(path.join(output, "dist"), { recursive: true });
mkdirSync(path.join(output, "src"), { recursive: true });
copyFileSync(path.join(root, "index.html"), path.join(output, "index.html"));
copyFileSync(
  path.join(root, "dist", "output.css"),
  path.join(output, "dist", "output.css"),
);
for (const file of ["app.js", "filesystem.js", "calculator.js"]) {
  copyFileSync(path.join(root, "src", file), path.join(output, "src", file));
}
cpSync(path.join(root, "icons"), path.join(output, "icons"), { recursive: true });
console.log("Built site/ with HTML, compiled CSS, scripts, and icons.");
