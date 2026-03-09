const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Define paths
const rootDir = __dirname;
const buildTempDir = path.join(rootDir, 'build_temp');

console.log('--- Market Tracer Production Build ---');
console.log('1. Cleaning up old temporary build paths...');
if (fs.existsSync(buildTempDir)) {
    fs.rmSync(buildTempDir, { recursive: true, force: true });
}
if (fs.existsSync(path.join(rootDir, 'dist'))) {
    fs.rmSync(path.join(rootDir, 'dist'), { recursive: true, force: true });
}

console.log('2. Copying project files to temporary build folder...');
// Copy everything EXCEPT node_modules, .git, and build artifacts
const excludeList = [
    'node_modules', '.git', 'dist', 'build_temp', 'capture.log',
    'server', 'Albion Data Client', 'bin', 'buildHooks', 'chat_images',
    'admin_index.html', 'build_admin_index.html', 'Yeni Metin Belgesi.txt'
];

function copySync(src, dest) {
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        const files = fs.readdirSync(src);
        for (const file of files) {
            if (excludeList.includes(file)) continue;
            copySync(path.join(src, file), path.join(dest, file));
        }
    } else {
        fs.copyFileSync(src, dest);
    }
}

copySync(rootDir, buildTempDir);

console.log('3. Running JavaScript Obfuscator on source files...');
// Apply heavy obfuscation to protect server interaction logic and algorithms
const obfCmd = `npx javascript-obfuscator "${buildTempDir}" --output "${buildTempDir}" --compact true --control-flow-flattening true --control-flow-flattening-threshold 0.75 --dead-code-injection true --dead-code-injection-threshold 0.4 --identifier-names-generator hexadecimal --rename-globals true --string-array true --string-array-encoding base64 --string-array-threshold 0.75 --transform-object-keys true --unicode-escape-sequence false`;

try {
    execSync(obfCmd, { stdio: 'inherit' });
    console.log('Obfuscation complete!');
} catch (e) {
    console.error('Obfuscation failed:', e);
    process.exit(1);
}

console.log('4. Copying node_modules to build_temp (so electron-builder has dependencies)...');
const destNodeModules = path.join(buildTempDir, 'node_modules');
if (!fs.existsSync(destNodeModules)) {
    fs.mkdirSync(destNodeModules);
}
// Using xcopy or native copy for node_modules is faster, but let's use npm install inside the temp folder to be safe
console.log('Installing production modules in build environment...');
execSync('npm install --ignore-scripts', { cwd: buildTempDir, stdio: 'inherit' });


console.log('5. Packaging Windows Executable with electron-builder...');
const ebuilderCmd = `npx electron-builder --win nsis -c.extraMetadata.main=main.js`;

try {
    execSync(ebuilderCmd, { cwd: buildTempDir, stdio: 'inherit' });
    console.log('Build successful!');
} catch (e) {
    console.error('Electron Builder failed:', e);
    process.exit(1);
}

// Move dist out
fs.renameSync(path.join(buildTempDir, 'dist'), path.join(rootDir, 'dist'));
fs.rmSync(buildTempDir, { recursive: true, force: true });

console.log('--- Build Successfully Completed. Output in /dist ---');
