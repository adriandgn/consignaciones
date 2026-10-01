import legacy from './legacy-seed.json' with {type:'json'};
import {applyAction,today} from './domain.js';
export function seed(){const s={version:7,suppliers:structuredClone(legacy.suppliers),items:structuredClone(legacy.items),sales:[],settlements:[],payments:[],returns:[],priceChanges:[],reviews:[],proposals:[],adjustments:[],audit:[],counters:{item:legacy.items.length,supplier:0}};
for(const i of s.items){if(i.status==='Vendida'){const sp=s.suppliers.find(x=>x.id===i.supplier);s.sales.push({id:'VTA-'+String((s.counters.sale=(s.counters.sale||0)+1)).padStart(4,'0'),code:i.code,supplier:i.supplier,desc:i.desc,date:i.date,price:i.sale,share:sp.share,amount:i.sale*sp.share/100,method:'Ejemplo histórico',demo:true,returned:false,settlement:null})}i.sale= i.status==='Vendida'?i.sale:0;}
const now=today(),ago=n=>{const d=new Date(now+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-n);return d.toISOString().slice(0,10)};let seq=0;const run=(type,payload)=>applyAction(s,{type,payload,request:'seed-'+(++seq)},'Preparación de prueba',now);
run('supplier',{name:'Andrea Aguirre',share:50,type:'Second hand',demo:true,bank:'SIN CUENTA REAL · PRUEBA',holder:'Andrea Aguirre · PRUEBA'});
const sp=s.suppliers.find(x=>x.name==='Andrea Aguirre');
for(const [desc,market,age,quality,notes] of [['Blazer de prueba',40000,20,'Excelente',''],['Camisa de prueba',20000,15,'Muy bueno',''],['Tapado fuera de temporada',60000,105,'Muy bueno',''],['Jean para revisión',30000,95,'Bueno con detalles','Desgaste leve en ruedo'],['Vestido para devolución',35000,100,'Excelente',''],['Remera pendiente de propuesta',12000,1,'Excelente','']]){run('item',{supplier:sp.id,desc,market,received:ago(age),quality,notes,brand:'EJEMPLO',size:'M',color:'Neutro'});const i=s.items.at(-1);if(!desc.startsWith('Remera'))run('price',{code:i.code,price:market,reason:'Aceptación inicial simulada',consent:true,consentDate:ago(1),consentRef:'Consentimiento ficticio para probar el circuito'})}
const its=s.items.filter(i=>i.supplier===sp.id);
run('sale',{code:its[0].code,price:40000,date:now,method:'Transferencia ficticia'});
run('settle',{supplier:sp.id,from:ago(30),to:now});const liq=s.settlements.at(-1);
run('payment',{id:liq.id,amount:10000,date:now,method:'Transferencia',reference:'EJEMPLO-NO-BANCARIO-001'});
run('sale',{code:its[1].code,price:20000,date:now,method:'Efectivo ficticio'});
run('proposal',{supplier:sp.id});return s;}
