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
    try {
        fs.rmSync(path.join(rootDir, 'dist'), { recursive: true, force: true });
    } catch (e) {
        if (e.code === 'EPERM') {
            console.error('\n!!! HATA: "dist" klasörü silinemedi (EPERM) !!!');
            console.error('Lütfen şunları kontrol edin:');
            console.error('1. Uygulama (Market Tracer) şu an açık mı? Açıksa kapatın.');
            console.error('2. "dist" klasörü bir Dosya Gezgini penceresinde açık mı? Açıksa kapatın.');
            console.error('3. Başka bir program (terminal vs.) bu klasörü kullanıyor mu?\n');
        }
        process.exit(1);
    }
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

console.log('3. Skipping JavaScript Obfuscator (Open Source Release)...');
/*
const obfCmd = ...
*/

console.log('4. Copying node_modules to build_temp (so electron-builder has dependencies)...');
const destNodeModules = path.join(buildTempDir, 'node_modules');
if (!fs.existsSync(destNodeModules)) {
    fs.mkdirSync(destNodeModules);
}
// Using xcopy or native copy for node_modules is faster, but let's use npm install inside the temp folder to be safe
console.log('Installing production modules in build environment...');
try {
    // Re-enable ignore-scripts to avoid local gyp build failures during install. 
    execSync('npm install --ignore-scripts', { cwd: buildTempDir, stdio: 'inherit' });

    console.log('Attempting to rebuild native modules for Electron...');
    // Use electron-rebuild to specifically target the electron version
    const electronVer = require(path.join(rootDir, 'package.json')).devDependencies.electron.replace('^', '');
    execSync(`npx electron-rebuild -v ${electronVer}`, { cwd: buildTempDir, stdio: 'inherit' });
} catch (e) {
    console.error('\n!!! HATA: Modül kurulumu veya derleme başarısız oldu !!!');
    console.error('Hata detayı:', e.message);
    process.exit(1);
}


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
