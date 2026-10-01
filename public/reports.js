import {today,daysSince,dueReview,balance,categoryOf,ownershipOf,isOwn} from './domain.js';
import {pendingFields} from './import-stock.js';
export const reportTypes=[['stock','Inventario de prendas'],['suppliers','Proveedores'],['sales','Ventas'],['returns','Devoluciones'],['settlements','Liquidaciones'],['payments','Pagos registrados'],['review','Prendas para revisión a los 90 días'],['proposals','Propuestas y respuestas'],['adjustments','Ajustes por devoluciones']];
export function reportData(s,f={},now=today()){
 const name=id=>s.suppliers.find(p=>p.id===id)?.name||id,sp=id=>s.suppliers.find(p=>p.id===id),item=code=>s.items.find(i=>i.code===code),demo=x=>x.demo?'PRUEBA':'REAL';
 const type=f.type||'stock',title=reportTypes.find(x=>x[0]===type)?.[1];if(!title)throw Error('Listado desconocido');
 if(f.from&&f.to&&f.from>f.to)throw Error('La fecha desde debe ser anterior o igual a hasta');
 const meta={stock:['items','received'],review:['items','received'],suppliers:['suppliers',null],sales:['sales','date'],returns:['returns','date'],settlements:['settlements','date'],payments:['payments','date'],proposals:['proposals','date'],adjustments:['adjustments','date']}[type];
 let records=s[meta[0]].filter(x=>!f.supplier||(type==='suppliers'?x.id:x.supplier)===f.supplier).filter(x=>!f.mode||(f.mode==='test'?!!x.demo:!x.demo));
 if(meta[1])records=records.filter(x=>(!f.from||(x[meta[1]]&&x[meta[1]]>=f.from))&&(!f.to||(x[meta[1]]&&x[meta[1]]<=f.to)));
 if(type==='stock'||type==='review')records=records.filter(i=>!f.status||i.status===f.status);
 if(type==='review')records=records.filter(i=>dueReview(i,now));
 if(f.query)records=records.filter(x=>[x.id,x.code,x.legacyCode,x.desc,x.brand,x.importBatch,x.reference,x.reason,x.status,x.name,name(x.supplier),item(x.code)?.legacyCode].join(' ').toLowerCase().includes(f.query.trim().toLowerCase()));
 const classified=['stock','review','sales','returns','adjustments'].includes(type);if(classified)records=records.filter(x=>{const i=item(x.code)||x;return (!f.ownership||ownershipOf(i)===f.ownership)&&(!f.category||categoryOf(x.category?x:i)===f.category)});
 let headers,rows;
 if(type==='stock'||type==='review'){
  headers=['THR / código de barras','Código anterior','Unidad anterior','Proveedor ID','Proveedor','Descripción','Marca','Talle','Color','Estado físico','Observaciones','Recepción original','Días desde recepción','Estado','Precio referencia ARS','Precio contado acordado ARS','% proveedor por prenda','% general proveedor','Aprobación original','Referencia aprobación','Próxima revisión','Alerta 90 días','Datos pendientes','Lote importación','Código de barras anterior','Tipo de datos'];
  rows=records.map(i=>[i.code,i.legacyCode,i.legacyUnit,i.supplier,name(i.supplier),i.desc,i.brand,i.size,i.color,i.quality,i.notes,i.received,i.received?daysSince(i.received,now):'',i.status,i.market,i.agreed||'',i.agreedShare,sp(i.supplier)?.share,i.historicalAgreement?.consentDate,i.historicalAgreement?.consentRef,i.nextReview,dueReview(i,now)?'REVISAR':'',pendingFields(i,sp(i.supplier)).join(', '),i.importBatch,i.legacyBarcode,demo(i)]);
 }else if(type==='suppliers'){
  headers=['Código proveedor','Nombre','Tipo','% proveedor','Email','Teléfono','DNI/CUIT','Domicilio','Condición fiscal','CBU/CVU/alias','Titular','Banco/billetera','Prendas registradas','Prendas sin salida','Activo','Tipo de datos'];
  rows=records.map(p=>[p.id,p.name,p.type,p.share,p.email,p.phone,p.taxId,p.address,p.fiscal,p.bank,p.holder,p.entity,s.items.filter(i=>i.supplier===p.id).length,s.items.filter(i=>i.supplier===p.id&&!['Vendida','Devuelta','Anulada'].includes(i.status)).length,p.active===false?'No':'Sí',demo(p)]);
 }else if(type==='sales'){
  headers=['Venta','Fecha','THR','Código anterior','Descripción','Proveedor ID','Proveedor','Cobrado al cliente ARS','Base contado / histórica ARS','Regla de liquidación','% proveedor histórico','Importe proveedor ARS','Medio cobro','Devuelta','Liquidación','Tipo de datos'];
  rows=records.map(x=>[x.id,x.date,x.code,item(x.code)?.legacyCode,x.desc,x.supplier,name(x.supplier),x.price,x.cashPrice??x.price,isOwn(x)?'Stock propio · sin liquidación':x.pricingRule?'Sobre contado acordado':'Registro anterior',x.share,x.amount,x.method,x.returned?'Sí':'No',x.settlement,demo(x)]);
 }else if(type==='returns'){
  headers=['Devolución','Fecha','Tipo devolución','THR','Código anterior','Proveedor ID','Proveedor','Motivo','Referencia','Reintegro ARS','Venta','Tipo de datos'];
  rows=records.map(x=>[x.id,x.date,x.type,x.code,item(x.code)?.legacyCode,x.supplier,name(x.supplier),x.reason,x.reference,x.refund,x.sale,demo(x)]);
 }else if(type==='settlements'){
  headers=['Liquidación','Fecha emisión','Desde','Hasta','Proveedor ID','Proveedor','Total ARS','Pagado ARS','Saldo ARS','Movimientos','Tipo de datos'];
  rows=records.map(x=>[x.id,x.date,x.from,x.to,x.supplier,x.name,x.total,Math.round((x.total-balance(s,x))*100)/100,balance(s,x),x.rows.length,demo(x)]);
 }else if(type==='payments'){
  headers=['Pago','Fecha','Liquidación','Proveedor ID','Proveedor','Importe ARS','Medio','Referencia','Tipo de datos'];rows=records.map(x=>[x.id,x.date,x.settlement,x.supplier,name(x.supplier),x.amount,x.method,x.reference,demo(x)]);
 }else if(type==='proposals'){
  headers=['Propuesta','Fecha','Proveedor ID','Proveedor','Estado','% proveedor','THR','Descripción','Precio propuesto ARS','Respuesta','Contrapropuesta ARS','Fecha respuesta','Referencia respuesta','Tipo de datos'];
  rows=records.flatMap(x=>x.rows.map(r=>{const a=x.answers?.find(y=>y.code===r.code);return [x.id,x.date,x.supplier,name(x.supplier),x.status,x.share,r.code,r.desc,r.price,a?.answer,a?.answer==='Contrapropuesta'?a.price:'',x.responded,x.responseRef,demo(x)]}));
 }else{
  headers=['Ajuste','Fecha','Proveedor ID','Proveedor','THR','Descripción','Cobrado ajustado ARS','Base contado / histórica ajustada ARS','% proveedor histórico','Importe ajuste ARS','Liquidación','Tipo de datos'];rows=records.map(x=>[x.id,x.date,x.supplier,name(x.supplier),x.code,x.desc,x.price,x.cashPrice??x.price,x.share,x.amount,x.settlement,demo(x)]);
 }
 if(classified){headers.splice(headers.length-1,0,'Propiedad','Categoría');rows.forEach((row,n)=>{const x=records[n],i=item(x.code)||x;row.splice(row.length-1,0,ownershipOf(i),categoryOf(x.category?x:i))})}
 const dateLabel=type==='stock'||type==='review'?'Recepción':type==='settlements'?'Emisión':'Fecha';
 const summary=[classified&&f.ownership,classified&&f.category,f.supplier?'Proveedor: '+name(f.supplier):'Todos los proveedores',f.mode?(f.mode==='test'?'Solo pruebas':'Solo reales'):'Pruebas y reales',meta[1]&&(f.from||f.to)?dateLabel+': '+(f.from||'inicio')+' a '+(f.to||'hoy'):'',f.status&&['stock','review'].includes(type)?'Estado: '+f.status:'',f.query?'Búsqueda: '+f.query:''].filter(Boolean).join(' · ');
 return {title,headers,rows,summary,generated:now,filename:'Therapy_'+type+'_'+now+'.csv'};
}
export function csvContent(rows){return rows.map(row=>row.map(value=>{
 if(typeof value==='number'&&Number.isFinite(value))return '"'+String(value).replace('.',',')+'"';
 let str=String(value??'');if(/^[\s]*[=+\-@]/.test(str)||/^[\t\r\n]/.test(str))str="'"+str;
 return '"'+str.replaceAll('"','""')+'"';
}).join(';')).join('\r\n')}
