#!/usr/bin/env node
// Build pipeline for the one-click bundled binaries.
//
//   node build/build.mjs bundle   → dist/bundle.cjs   (esbuild: ESM → single CJS)
//   node build/build.mjs all      → bundle + binaries + .app bundles + zips
//
// Two stages because pkg packages a single CJS file most reliably:
//   1. esbuild inlines bin/cli.mjs + connector.mjs + vendored SDK/BCF into one
//      CommonJS file (the project is zero-dep, so the bundle is self-contained).
//   2. @yao-pkg/pkg embeds a Node runtime around that bundle, producing native
//      executables that need no Node install on the target machine.
//
// Output: dist/Mycelium-for-Solibri-Windows.zip and -macOS.zip — each a ready
// "installer" folder (binary/app + install script + README).
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, chmodSync, existsSync, cpSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const bundle = join(dist, 'bundle.cjs');
const installerSrc = join(root, 'installer');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

// Node runtime baked into each binary. node22 has prebuilt pkg base binaries
// for all three targets (so cross-building from Linux/CI works).
const WIN = { pkg: 'node22-win-x64', out: 'mycelium-for-solibri.exe' };
const MAC = [
  { pkg: 'node22-macos-arm64', bin: 'mycelium-macos-arm64', app: 'Mycelium for Solibri (Apple Silicon).app' },
  { pkg: 'node22-macos-x64', bin: 'mycelium-macos-x64', app: 'Mycelium for Solibri (Intel).app' },
];

function sh(cmd, args, opts = {}) {
  console.log(`$ ${cmd} ${args.join(' ')}`);
  execFileSync(cmd, args, { stdio: 'inherit', cwd: root, ...opts });
}

function doBundle() {
  mkdirSync(dist, { recursive: true });
  sh(npx, [
    'esbuild', join(root, 'bin', 'cli.mjs'),
    '--bundle', '--platform=node', '--format=cjs', '--target=node18',
    `--outfile=${bundle}`,
  ]);
  console.log(`✓ bundled → ${bundle}`);
}

// macOS: wrap a pkg binary into a double-clickable .app. The bundle executable
// is a launcher that opens Terminal and runs the embedded binary, so a CLI
// launched from Finder still shows its output.
function makeApp(binPath, appName) {
  const app = join(dist, appName);
  rmSync(app, { recursive: true, force: true });
  const macos = join(app, 'Contents', 'MacOS');
  mkdirSync(macos, { recursive: true });

  cpSync(binPath, join(macos, 'mycelium-bin'));
  chmodSync(join(macos, 'mycelium-bin'), 0o755);

  writeFileSync(join(macos, 'launcher'),
    '#!/bin/bash\nDIR="$(cd "$(dirname "$0")" && pwd)"\nopen -a Terminal "$DIR/mycelium-bin"\n');
  chmodSync(join(macos, 'launcher'), 0o755);

  writeFileSync(join(app, 'Contents', 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Mycelium for Solibri</string>
  <key>CFBundleDisplayName</key><string>Mycelium for Solibri</string>
  <key>CFBundleIdentifier</key><string>com.mycelium.solibri</string>
  <key>CFBundleVersion</key><string>0.1.0</string>
  <key>CFBundleShortVersionString</key><string>0.1.0</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleExecutable</key><string>launcher</string>
  <key>LSMinimumSystemVersion</key><string>10.13</string>
</dict>
</plist>
`);
  console.log(`✓ packaged → ${appName}`);
}

function zipDir(stageDir, zipName) {
  rmSync(join(dist, zipName), { force: true });
  // -y preserves symlinks, important for .app bundles.
  sh('zip', ['-ry', zipName, '.'], { cwd: stageDir, stdio: 'inherit' });
  cpSync(join(stageDir, zipName), join(dist, zipName));
  console.log(`✓ ${zipName}`);
}

function buildWindows() {
  if (!existsSync(bundle)) doBundle();
  const exe = join(dist, WIN.out);
  sh(npx, ['pkg', bundle, '--targets', WIN.pkg, '--output', exe]);
  const stage = join(dist, 'stage-win');
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(stage, { recursive: true });
  cpSync(exe, join(stage, WIN.out));
  cpSync(join(installerSrc, 'Install-Windows.cmd'), join(stage, 'Install-Windows.cmd'));
  cpSync(join(installerSrc, 'README-FIRST.txt'), join(stage, 'README-FIRST.txt'));
  zipDir(stage, 'Mycelium-for-Solibri-Windows.zip');
}

function buildMac() {
  if (!existsSync(bundle)) doBundle();
  const stage = join(dist, 'stage-mac');
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(stage, { recursive: true });
  for (const m of MAC) {
    const bin = join(dist, m.bin);
    sh(npx, ['pkg', bundle, '--targets', m.pkg, '--output', bin]);
    makeApp(bin, m.app);
    cpSync(join(dist, m.app), join(stage, m.app), { recursive: true });
  }
  const installer = join(stage, 'Install-macOS.command');
  cpSync(join(installerSrc, 'Install-macOS.command'), installer);
  chmodSync(installer, 0o755);
  cpSync(join(installerSrc, 'README-FIRST.txt'), join(stage, 'README-FIRST.txt'));
  zipDir(stage, 'Mycelium-for-Solibri-macOS.zip');
}

const cmd = process.argv[2] ?? 'all';
if (cmd === 'bundle') {
  doBundle();
} else if (cmd === 'all') {
  doBundle();
  buildWindows();
  buildMac();
  console.log('\nDistributables in dist/:');
  console.log('  • Mycelium-for-Solibri-Windows.zip   (.exe + installer)');
  console.log('  • Mycelium-for-Solibri-macOS.zip     (.app ×2 + installer)');
} else {
  console.error(`Unknown command: ${cmd}. Use "bundle" or "all".`);
  process.exit(1);
}
