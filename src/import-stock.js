const norm=v=>String(v??'').trim().toLocaleLowerCase('es');
const str=v=>String(v??'').trim();
const fail=(ok,msg)=>{if(!ok)throw Error(msg)};
const validDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
function number(v,label,min,max){if(v===''||v==null)return null;const n=Number(v);fail(Number.isFinite(n)&&n>=min&&n<=max,label+' inválido');return n}
export function pendingFields(i,s){return [!i.received&&'fecha de recepción',(!i.desc||i.detailPending)&&'descripción',(!i.quality||i.quality==='Pendiente')&&'estado físico',!(i.agreed>0)&&'precio acordado',i.ownership!=='Propio'&&(i.agreedShare??s?.share)==null&&'porcentaje',!['Vintage','Second hand','Upcycling'].includes(i.category||i.type)&&'categoría',i.ownership!=='Propio'&&i.importBatch&&!i.historicalAgreement&&'acuerdo histórico'].filter(Boolean)}
export function importStock(state,p,now){
 const s=structuredClone(state),result={rows:[],createdSuppliers:0,createdItems:0,skipped:0};
 fail(Array.isArray(p.rows)&&p.rows.length>0&&p.rows.length<=2000,'Importá entre 1 y 2.000 filas por vez');
 fail(str(p.filename).length>0&&str(p.filename).length<=240,'Nombre de archivo inválido');
 s.imports??=[];
 const next=(key,prefix,width)=>{const records=key==='item'?s.items:s.suppliers;const max=records.reduce((n,x)=>Math.max(n,Number((x.code||x.id).startsWith(prefix)?(x.code||x.id).slice(prefix.length):0)||0),0);s.counters[key]=Math.max(s.counters[key]||0,max)+1;return prefix+String(s.counters[key]).padStart(width,'0')};
 const batch='IMP-'+String((s.counters.import||0)+1).padStart(4,'0'),seen=new Set();let units=0;
 for(let index=0;index<p.rows.length;index++){
  const r=p.rows[index],line='Fila '+(r.line||index+2)+': ';
  try{
   for(const v of Object.values(r))fail(v==null||['string','number','boolean'].includes(typeof v),'Valor de celda inválido');
   for(const v of Object.values(r))fail(str(v).length<=1000,'Una celda supera 1.000 caracteres');
   const name=str(r.supplierName),supplierId=str(r.supplierId),oldCode=str(r.oldCode),desc=str(r.desc);
   const own=norm(r.ownership)==='propio';fail(!str(r.ownership)||['propio','consignación','consignacion'].includes(norm(r.ownership)),'Propiedad inválida: usá Propio o Consignación');const category=str(r.category);fail(!category||['Vintage','Second hand','Upcycling'].includes(category),'Categoría inválida');
   fail(own||name||supplierId,'Indicá nombre o código de proveedor');
   let candidates=supplierId?s.suppliers.filter(x=>x.id===supplierId):s.suppliers.filter(x=>norm(x.name)===norm(name));
   fail(candidates.length<=1,'Hay varios proveedores con ese nombre: indicá su código PRV');
   let sp=own?{id:'',name:'Therapy · stock propio',demo:p.demo===true}:candidates[0];
   if(!own&&supplierId)fail(sp,'Código de proveedor inexistente');
   if(!own&&sp&&name)fail(norm(sp.name)===norm(name),'El código y el nombre del proveedor no coinciden');
   if(sp&&r.taxId&&sp.taxId)fail(str(r.taxId).replace(/\D/g,'')===str(sp.taxId).replace(/\D/g,''),'El DNI/CUIT no coincide con el proveedor existente');
   const share=number(r.share,'Porcentaje del proveedor',0,100);
   if(!sp){sp={id:next('supplier','PRV-',4),name,share,type:'Second hand',email:str(r.email),phone:str(r.phone),taxId:str(r.taxId),bank:'',holder:'',address:'',active:true,demo:p.demo===true,imported:true};s.suppliers.push(sp);result.createdSuppliers++}
   fail((sp.demo===true)===(p.demo===true),'El proveedor es '+(sp.demo?'de prueba':'real')+'. Ajustá el modo de importación');
   if(!oldCode&&!desc&&!str(r.quantity)){result.rows.push({line:r.line||index+2,supplier:sp.id,name:sp.name,oldCode:'',code:'',outcome:'Solo proveedor'});continue}
   fail(oldCode,'Falta código anterior. Si no existía, asigná una referencia única en el Excel');
   const group=sp.id+'|'+(p.demo?'test':'real')+'|'+norm(oldCode);fail(!seen.has(group),'Código anterior repetido para el mismo proveedor dentro del archivo');seen.add(group);
   const qty=number(r.quantity,'Cantidad',1,2000)??1;fail(Number.isInteger(qty),'La cantidad debe ser entera');units+=qty;fail(units<=2000,'Máximo 2.000 unidades por importación');
   const received=str(r.received);fail(!received||(validDate(received)&&received<=now),'Fecha de recepción inválida o futura (usá AAAA-MM-DD o DD/MM/AAAA)');
   const market=number(r.price,'Precio',0.01,9999999999),quality=str(r.quality)||'Pendiente';fail(['Pendiente','Excelente','Muy bueno','Bueno con detalles','No apto'].includes(quality),'Estado físico inválido');
   const existing=s.items.filter(i=>i.supplier===sp.id&&!!i.demo===!!p.demo&&norm(i.legacyCode)===norm(oldCode));
   if(existing.length){fail(existing.length===qty,'El código anterior ya existe con otra cantidad. Revisá las prendas existentes antes de importar');for(const i of existing){result.rows.push({line:r.line||index+2,supplier:sp.id,name:sp.name,oldCode,unit:i.legacyUnit||1,code:i.code,outcome:'Ya existe · sin cambios'});result.skipped++}continue}
   for(let unit=1;unit<=qty;unit++){
    const code=next('item','THR-',6),i={code,supplier:sp.id,ownership:own?'Propio':'Consignación',category:category||(!own&&sp.type!=='Mixto'?sp.type:'Pendiente'),legacyCode:oldCode,legacyBarcode:str(r.oldBarcode),legacyUnit:unit,legacyQuantity:qty,importBatch:batch,importedAt:now,desc:desc||'Detalle pendiente · '+oldCode,detailPending:!desc,brand:str(r.brand),size:str(r.size),color:str(r.color),quality,notes:str(r.notes),type:sp.type,received,market,agreed:0,importedShare:share,status:'Pendiente',confirmation:'Pendiente de documentar',demo:sp.demo};
    s.items.push(i);result.createdItems++;result.rows.push({line:r.line||index+2,supplier:sp.id,name:sp.name,oldCode,unit,code,outcome:'Nueva · '+pendingFields(i,sp).join(', ')})
   }
  }catch(e){throw Error(line+e.message)}
 }
 if(result.createdItems||result.createdSuppliers){s.counters.import=(s.counters.import||0)+1;s.imports.push({id:batch,date:now,filename:str(p.filename),demo:p.demo===true,...result})}
 return {state:s,result,batch:result.createdItems||result.createdSuppliers?batch:null};
}
