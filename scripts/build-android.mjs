import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const mode = process.argv[2] || 'sync';
if (!['sync', 'debug'].includes(mode)) throw new Error('Use sync ou debug.');
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Comando encerrou com codigo ${result.status}`);
}
function sdkPath() {
  const local = path.join(root, 'android', 'local.properties');
  const configured = existsSync(local) ? /^sdk\.dir=(.+)$/m.exec(readFileSync(local, 'utf8'))?.[1]?.trim().replace(/\\:/g, ':').replace(/\\\\/g, '\\') : undefined;
  const candidates = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT, configured, process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk'), path.join(homedir(), 'Library', 'Android', 'sdk'), path.join(homedir(), 'Android', 'Sdk')];
  return candidates.find(candidate => candidate && (existsSync(path.join(candidate, 'platform-tools')) || existsSync(path.join(candidate, 'platforms'))));
}
let gradleEnv = { ...process.env };
if (mode === 'debug') {
  const sdk = sdkPath();
  if (!sdk) throw new Error('Android SDK nao encontrado. Configure ANDROID_HOME ou android/local.properties pelo Android Studio e execute npm run apk:debug novamente.');
  const bundledJdk = process.platform === 'win32' ? 'C:\\Program Files\\Android\\Android Studio\\jbr' : '';
  const javaHome = process.env.JAVA_HOME || (bundledJdk && existsSync(path.join(bundledJdk, 'bin', 'java.exe')) ? bundledJdk : undefined);
  gradleEnv = { ...gradleEnv, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk, ...(javaHome ? { JAVA_HOME: javaHome, PATH: path.join(javaHome, 'bin') + path.delimiter + process.env.PATH } : {}) };
}
process.chdir(root);
run(process.execPath, ['node_modules/typescript/bin/tsc', '-b']);
globalThis.__dirname = root;
const { build } = await import('vite');
await build({ configLoader: 'runner' });
run(process.execPath, ['node_modules/@capacitor/cli/bin/capacitor', 'sync', 'android']);
console.log('Android sincronizado com o frontend e os plugins instalados.');
if (mode === 'debug') {
  if (process.platform === 'win32') run('cmd.exe', ['/d', '/s', '/c', 'gradlew.bat assembleDebug --no-daemon'], { cwd: path.join(root, 'android'), env: gradleEnv });
  else run('./gradlew', ['assembleDebug', '--no-daemon'], { cwd: path.join(root, 'android'), env: gradleEnv });
  console.log('APK de teste: android/app/build/outputs/apk/debug/app-debug.apk');
}
