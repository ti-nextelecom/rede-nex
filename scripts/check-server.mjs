import {readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const files=[];
async function walk(directory) {
  for (const entry of await readdir(directory,{withFileTypes:true})) {
    const path=join(directory,entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (entry.isFile() && /\.(?:js|mjs|cjs)$/.test(entry.name)) files.push(path);
  }
}
for (const path of ['server/src','server/scripts','shared','deploy']) await walk(path);
files.push('ecosystem.config.cjs','scripts/build-release.mjs','scripts/build-android.mjs');
for (const path of files) {
  const result=spawnSync(process.execPath,['--check',path],{stdio:'inherit',windowsHide:true});
  if (result.error) throw result.error;
  if (result.status!==0) process.exit(result.status||1);
}
console.log('Syntax validated: '+files.length+' server/shared/deploy files');
