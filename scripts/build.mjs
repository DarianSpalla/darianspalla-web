import fs from 'node:fs/promises';
import { build } from 'esbuild';
await fs.rm('dist',{recursive:true,force:true});await fs.mkdir('dist',{recursive:true});
for(const entry of await fs.readdir('public',{withFileTypes:true})){
 if(!entry.isFile()||['hostinger-portal.js','instalar.html'].includes(entry.name))continue;
 await fs.copyFile('public/'+entry.name,'dist/'+entry.name);
}
await build({entryPoints:['src/worker.js'],bundle:true,format:'esm',platform:'browser',outfile:'dist/_worker.js',minify:true});
await fs.writeFile('dist/_routes.json',JSON.stringify({version:1,include:['/api/*','/portal','/portal.html','/instalar.html'],exclude:[]}));
console.log('Built Pages frontend and authenticated D1 backend.');
