import test from 'node:test';import assert from 'node:assert/strict';import {seed} from '../src/seed.mjs';import {applyAction,today,listPrice} from '../src/domain.js';import {reportData} from '../public/reports.js';
const run=(s,type,payload)=>applyAction(s,{type,payload,request:crypto.randomUUID()},'Prueba');
test('cash and credit produce identical supplier amount; return reverses cash base and allows full card refund',()=>{
 const s=seed(),i=s.items.find(x=>x.desc==='Jean para revisión'),cash=i.agreed,sp=s.suppliers.find(x=>x.id===i.supplier);const historic=JSON.stringify(s.settlements);
 run(s,'sale',{code:i.code,price:listPrice(cash),date:today(),method:'Tarjeta'});const v=s.sales.at(-1);assert.equal(v.price,listPrice(cash));assert.equal(v.cashPrice,cash);assert.equal(v.amount,Math.round(cash*sp.share)/100);assert.equal(JSON.stringify(s.settlements),historic);
 const report=reportData(s,{type:'sales',query:v.id});assert.equal(report.rows[0][8],cash);
 run(s,'settle',{supplier:sp.id,from:today(),to:today()});const liq=s.settlements.at(-1),row=liq.rows.find(x=>x.id===v.id);assert.equal(row.cashPrice,cash);assert.equal(row.amount,v.amount);
 i.agreed=cash+1234;sp.share=90;assert.equal(row.cashPrice,cash);assert.equal(row.share,50);
 run(s,'returnCustomer',{code:i.code,date:today(),reason:'Talle',reference:'Reintegro tarjeta',refund:v.price,destination:'Publicada'});assert.equal(s.returns.at(-1).refund,v.price);assert.equal(s.adjustments.at(-1).cashPrice,-cash);assert.equal(s.adjustments.at(-1).amount,-v.amount);
});
test('server rejects arbitrary amounts or client supplied cash base and keeps authorized discounts',()=>{
 const s=seed(),i=s.items.find(x=>x.desc==='Tapado fuera de temporada');assert.throws(()=>run(s,'sale',{code:i.code,price:i.agreed+1,date:today(),method:'Tarjeta'}),/coincidir/);
 run(s,'price',{code:i.code,price:40000,reason:'Descuento acordado',consent:true,consentDate:today(),consentRef:'Mail prueba'});
 run(s,'sale',{code:i.code,price:52000,cashPrice:1,share:1,date:today(),method:'Tarjeta'});assert.equal(s.sales.at(-1).cashPrice,40000);assert.equal(s.sales.at(-1).amount,20000);
 assert.equal(listPrice(199.99),259.99);
});
