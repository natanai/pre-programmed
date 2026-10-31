// Run after building a baseline and candidate with the same toolchain:
// node scripts/measure-premidi-runtime.mjs /tmp/baseline/dist dist
// Do not infer audio engine cost from Windows Electron ZIP or pre-midi's Tauri ZIP.
import {readdir,readFile,stat} from "node:fs/promises";
import {gzipSync} from "node:zlib";
import {resolve,relative,join} from "node:path";
async function measure(directory){
 const files=[];
 async function visit(path){
  for(const item of await readdir(path,{withFileTypes:true})){
   const full=join(path,item.name);
   if(item.isDirectory()){await visit(full);continue;}
   if(!item.isFile()||!/\.(?:js|css)$/.test(item.name))continue;
   const bytes=await readFile(full);
   files.push({file:relative(directory,full),type:item.name.endsWith(".js")?"js":"css",
    bytes:bytes.length,gzipBytes:gzipSync(bytes,{level:9}).length});
  }
 }
 await visit(directory);
 const total=(kind,key)=>files.filter(f=>f.type===kind).reduce((n,f)=>n+f[key],0);
 return {jsBytes:total("js","bytes"),jsGzipBytes:total("js","gzipBytes"),
  cssBytes:total("css","bytes"),cssGzipBytes:total("css","gzipBytes"),files};
}
const [a,b]=process.argv.slice(2).map(path=>resolve(path));
if(!a||!b||a===b)throw Error("Pass two distinct compiled dist directories: baseline and candidate");
const baseline=await measure(a),candidate=await measure(b);
const delta={jsBytes:candidate.jsBytes-baseline.jsBytes,
 jsGzipBytes:candidate.jsGzipBytes-baseline.jsGzipBytes,
 cssBytes:candidate.cssBytes-baseline.cssBytes,
 cssGzipBytes:candidate.cssGzipBytes-baseline.cssGzipBytes};
const report={schemaVersion:1,measurement:"same-run Vite production output (all JS/CSS assets, not just entry chunk)",
 baseline,candidate,delta};
console.log("PREMIDI_GAME_BUNDLE "+JSON.stringify(report));
