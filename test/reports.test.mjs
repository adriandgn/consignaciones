import test from 'node:test';import assert from 'node:assert/strict';import {seed} from '../src/seed.mjs';import {reportData,reportTypes,csvContent} from '../public/reports.js';import {parseCSV} from '../src/excel-import.js';
test('exports preserve records, match filters, keep historical amounts and distinguish tests',()=>{
 const s=seed(),before=JSON.stringify(s),p=s.suppliers.find(x=>x.name==='Andrea Aguirre');
 const stock=reportData(s,{type:'stock',supplier:p.id,status:'Pendiente',query:'Remera',mode:'test'});assert.equal(stock.rows.length,1);assert.equal(stock.rows[0][0],s.items.find(i=>i.desc==='Remera pendiente de propuesta').code);assert.equal(stock.rows[0].at(-1),'PRUEBA');
 assert.equal(reportData(s,{type:'stock',supplier:p.id,mode:'real'}).rows.length,0);
 assert.equal(reportData(s,{type:'stock',from:'2099-01-01'}).rows.length,0);
 const l=s.settlements.find(x=>x.supplier===p.id),row=reportData(s,{type:'settlements',supplier:p.id}).rows[0];assert.equal(row[6],l.total);assert.equal(row[7],10000);assert.equal(row[8],10000);
 for(const [type] of reportTypes){const report=reportData(s,{type});for(const r of report.rows)assert.equal(r.length,report.headers.length,type)}
 assert.equal(JSON.stringify(s),before);assert.throws(()=>reportData(s,{from:'2026-02-01',to:'2026-01-01'}),/fecha/);
});
test('CSV safely escapes text and preserves decimals, negative adjustments, accents and codes',()=>{
 const parsed=parseCSV(csvContent([['Código','Detalle','Importe'],['000041','Camisa; "algodón"\nAzul',-1250.5],['=1+1',' @SUM(1)',0]]));assert.equal(parsed[1][0],'000041');assert.equal(parsed[1][1],'Camisa; "algodón"\nAzul');assert.equal(parsed[1][2],'-1250,5');assert.equal(parsed[2][0],"'=1+1");assert.equal(parsed[2][1],"' @SUM(1)");assert.equal(parsed[2][2],'0');
});
