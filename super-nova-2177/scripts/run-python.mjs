import { existsSync } from "fs";
import { spawnSync } from "child_process";
import path from "path";

const projectRoot = process.cwd();
const candidates = [
  path.join(projectRoot, ".venv", "Scripts", "python.exe"),
  path.join(projectRoot, ".venv", "bin", "python"),
  process.env.PYTHON,
  "python",
].filter(Boolean);

const pythonBin = candidates.find((candidate) => candidate === "python" || existsSync(candidate));

if (!pythonBin) {
  console.error("No Python runtime found. Create .venv or set PYTHON.");
  process.exit(1);
}

const result = spawnSync(pythonBin, process.argv.slice(2), {
  cwd: projectRoot,
  stdio: "inherit",
  shell: false,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
