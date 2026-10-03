const { readdirSync, statSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

function listTestFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (name === 'node_modules' || name === 'spikes') {
      return [];
    }
    if (statSync(path).isDirectory()) {
      return listTestFiles(path);
    }
    return name.endsWith('.test.mjs') ? [path] : [];
  });
}

async function importAll() {
  for (const file of listTestFiles(__dirname).sort()) {
    await import(pathToFileURL(resolve(file)).href);
  }
}

importAll();
