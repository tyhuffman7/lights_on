import {readdirSync,readFileSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
const digest=(data:string|Buffer)=>createHash('sha256').update(data).digest('hex');
export function sourceManifest(root:string){
 const result:Record<string,string>={};
 const visit=(folder:string)=>{for(const e of readdirSync(folder,{withFileTypes:true})){const p=resolve(folder,e.name);if(e.isDirectory())visit(p);else if(/\.(ts|mjs)$/.test(p))result[relative(root,p)]=digest(readFileSync(p));}};
 for(const d of ['lib','worker'])visit(resolve(root,d));
 for(const p of ['scripts/screen-supervisor.mjs','scripts/executable-screen-launch.mjs'])result[p]=digest(readFileSync(resolve(root,p)));
 return result;
}
