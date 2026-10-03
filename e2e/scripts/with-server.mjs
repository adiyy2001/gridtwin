import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const jar = resolve(root, 'api/target/quarkus-app/quarkus-run.jar');
const port = process.env.GRIDTWIN_PORT ?? '18480';
const base = `http://127.0.0.1:${port}`;
const startupTimeoutMs = 60_000;

const separator = process.argv.indexOf('--');
const command = separator === -1 ? [] : process.argv.slice(separator + 1);

if (command.length === 0) {
  console.error('usage: with-server.mjs -- <command> [arguments]');
  process.exit(2);
}

async function isReady() {
  try {
    const response = await fetch(`${base}/q/health/ready`);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitUntilReady(server) {
  const deadline = Date.now() + startupTimeoutMs;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`the server exited early with code ${server.exitCode}`);
    }
    if (await isReady()) {
      return;
    }
    await new Promise((done) => setTimeout(done, 300));
  }
  throw new Error(`the server did not answer on ${base} within ${startupTimeoutMs} ms`);
}

function runCommand() {
  return new Promise((done) => {
    const child = spawn(command[0], command.slice(1), {
      stdio: 'inherit',
      cwd: resolve(root, 'e2e'),
      env: { ...process.env, GRIDTWIN_BASE_URL: base },
    });
    child.on('exit', (code, signal) => done(code ?? (signal === null ? 1 : 130)));
  });
}

async function main() {
  if (await isReady()) {
    console.log(`using the server already running on ${base}`);
    return runCommand();
  }
  if (!existsSync(jar)) {
    console.error(`missing ${jar}, run tools/build-all.sh first`);
    return 1;
  }
  const server = spawn(
    'java',
    [`-Dquarkus.http.host=127.0.0.1`, `-Dquarkus.http.port=${port}`, '-jar', jar],
    { stdio: ['ignore', 'ignore', 'inherit'] },
  );
  try {
    await waitUntilReady(server);
    console.log(`server pid ${server.pid} is ready on ${base}`);
    return await runCommand();
  } catch (error) {
    console.error(error.message);
    return 1;
  } finally {
    if (server.exitCode === null) {
      server.kill('SIGTERM');
    }
  }
}

process.exit(await main());
