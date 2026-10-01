import fs from 'node:fs';
import {build} from 'esbuild';
fs.rmSync('dist',{recursive:true,force:true});
fs.cpSync('public','dist',{recursive:true});
for(const file of ['domain.js','import-stock.js'])fs.copyFileSync('src/'+file,'dist/'+file);
await build({entryPoints:['src/barcode.js'],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:'dist/barcode.js'});
await build({entryPoints:['src/excel-import.js'],bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,outfile:'dist/excel-import.js'});
console.log('Therapy: sitio estático en dist; API de Vercel en api/handler.js.');
