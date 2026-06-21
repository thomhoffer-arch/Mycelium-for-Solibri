#!/usr/bin/env node
// Binary entry point for the bundled one-click executable (.exe / .app).
//
// Unlike connector.mjs (which is the raw dev CLI), this entry is built for
// double-click use by a non-developer:
//   • resolves config from a solibri.config.json next to the executable,
//     falling back to environment variables, then to the offline demo;
//   • prints a human-readable summary (not just raw JSON);
//   • writes the full spine output to solibri-spine-output.json next to the
//     executable so it can be inspected/handed off;
//   • keeps the console window open at the end when launched interactively,
//     so a double-clicked window doesn't vanish before it can be read.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { run } from '../connector.mjs';

// When packaged by pkg/@yao-pkg/pkg, process.pkg is set and process.execPath is
// the binary. In dev (node bin/cli.mjs), use cwd.
const isPackaged = Boolean(process.pkg);

// Where config + output live. A portable .exe keeps them next to itself; a
// macOS .app bundle is read-only, so fall back to a writable home folder.
function resolveBaseDir() {
  if (process.env.MYCELIUM_HOME) return process.env.MYCELIUM_HOME;
  if (!isPackaged) return process.cwd();
  const exeDir = dirname(process.execPath);
  if (exeDir.includes(`.app${join('/', 'Contents', 'MacOS')}`) || exeDir.includes('.app/Contents/MacOS')) {
    return join(homedir(), 'MyceliumForSolibri');
  }
  return exeDir; // portable .exe / bare binary
}

const baseDir = resolveBaseDir();
if (isPackaged && !existsSync(baseDir)) {
  try { mkdirSync(baseDir, { recursive: true }); } catch { /* best effort */ }
}
const CONFIG_FILE = join(baseDir, 'solibri.config.json');
const OUTPUT_FILE = join(baseDir, 'solibri-spine-output.json');

const CONFIG_TEMPLATE = {
  SOLIBRI_BASE_URL: 'http://localhost:10876/solibri/v1',
  SOLIBRI_PROJECT_KEY: 'horizons',
  SOLIBRI_TOKEN: '',
  SOLIBRI_CHECKING_PATH: '',
};

// Merge config sources into an env-shaped object the connector understands.
// Precedence: real environment variables > config file > nothing (demo mode).
function resolveEnv() {
  let fileCfg = {};
  if (existsSync(CONFIG_FILE)) {
    try {
      fileCfg = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
    } catch (err) {
      console.error(`Could not parse ${CONFIG_FILE}: ${err?.message ?? err}\nUsing defaults.`);
    }
  } else if (isPackaged) {
    // First run: drop an editable template so the user can point it at Solibri.
    try {
      writeFileSync(CONFIG_FILE, JSON.stringify(CONFIG_TEMPLATE, null, 2));
      console.log(`Created a config template at:\n  ${CONFIG_FILE}\nEdit it to connect to Solibri Desktop, then run again.\n`);
    } catch { /* best effort */ }
  }
  const keys = ['SOLIBRI_BASE_URL', 'SOLIBRI_TOKEN', 'SOLIBRI_PROJECT_KEY', 'SOLIBRI_CHECKING_PATH'];
  const env = {};
  for (const k of keys) {
    const v = process.env[k] ?? fileCfg[k];
    if (v != null && v !== '') env[k] = String(v);
  }
  return env;
}

function pauseIfInteractive() {
  // Only pause when a real console is attached (double-click on Windows, or a
  // terminal). Skip in pipes/CI so scripted use isn't blocked.
  if (process.env.MYCELIUM_NO_PAUSE === '1') return;
  if (!process.stdout.isTTY || !process.stdin.isTTY) return;
  process.stdout.write('\nPress Enter to close…');
  try {
    // Synchronous read so the process stays alive until the user responds.
    readFileSync('/dev/stdin');
  } catch {
    // /dev/stdin not readable (Windows): fall back to a blocking stdin resume.
    process.stdin.resume();
    return new Promise((resolve) => process.stdin.once('data', resolve));
  }
}

async function main() {
  const env = resolveEnv();
  const mode = env.SOLIBRI_BASE_URL ? `live → ${env.SOLIBRI_BASE_URL}` : 'offline demo (no SOLIBRI_BASE_URL set)';

  console.log('Mycelium for Solibri');
  console.log('────────────────────');
  console.log(`Mode:    ${mode}`);
  console.log(`Project: ${env.SOLIBRI_PROJECT_KEY ?? 'horizons (default)'}`);
  if (isPackaged) console.log(`Config:  ${CONFIG_FILE}`);
  console.log('');

  let result;
  try {
    result = await run(env);
  } catch (err) {
    console.error('Run failed:', err?.message ?? err);
    if (env.SOLIBRI_BASE_URL) {
      console.error('Is Solibri Desktop running with the REST API enabled at that URL?');
    }
    await pauseIfInteractive();
    process.exit(2);
  }

  const recs = result.records ?? [];
  console.log(`Records: ${recs.length}   Conformant: ${result.conformant ? 'yes ✓' : 'NO ✗'}`);
  for (const r of recs) {
    const id = r.identity ?? {};
    const join = id.ifcGuid ? `ifcGuid ${id.ifcGuid}` : id.zone ? `zone ${id.zone.id ?? ''}` : 'no join key';
    console.log(`  • ${id.sourceLocalId}  [${join}]${r.conformant ? '' : '  ✗ ' + (r.errors || []).join('; ')}`);
  }

  try {
    writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
    console.log(`\nFull output written to:\n  ${OUTPUT_FILE}`);
  } catch (err) {
    console.error(`\nCould not write output file: ${err?.message ?? err}`);
  }

  await pauseIfInteractive();
  process.exit(result.conformant ? 0 : 1);
}

main();
