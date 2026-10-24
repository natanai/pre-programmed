const path = require("node:path");

// Windows Explorer passes a dropped file to the executable as an argument.
function projectPathFromArguments(argv, workingDirectory = process.cwd()) {
  for (const arg of argv.slice(1)) {
    if (typeof arg !== "string" || arg.startsWith("--") || path.extname(arg).toLowerCase() !== ".ppgame") continue;
    return path.resolve(workingDirectory, arg);
  }
  return null;
}

module.exports = { projectPathFromArguments };
