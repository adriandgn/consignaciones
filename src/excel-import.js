import readExcelFile from 'read-excel-file/browser';
export async function readWorkbook(file){
 if(file.size>8*1024*1024)throw Error('Máximo 8 MB. Dividí el archivo si es mayor.');
 if(/\.xlsx$/i.test(file.name))return await readExcelFile(file,{trim:false});
 if(!/\.csv$/i.test(file.name))throw Error('Usá Excel .xlsx o CSV. Para un .xls antiguo, guardalo como .xlsx.');
 return [{sheet:'CSV',data:parseCSV(await file.text())}];
}
export function parseCSV(text){
 text=text.replace(/^\uFEFF/,'');const first=text.split(/\r?\n/)[0],delimiter=(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?';':',';
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(!quoted&&c===delimiter){row.push(cell);cell=''}else if(!quoted&&(c==='\n'||c==='\r')){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell=''}else cell+=c}
 if(quoted)throw Error('CSV con comillas sin cerrar');if(cell||row.length){row.push(cell);rows.push(row)}return rows;
}
export const columns=[['ownership','Propiedad (Propio / Consignación)',['propiedad','ownership']],['category','Categoría (Vintage / Second hand / Upcycling)',['categoria','category']],['supplierName','Proveedor',['nombre','proveedor','consignante','nombre proveedor']],['supplierId','Código de proveedor en este portal (opcional)',['proveedor id','codigo proveedor portal']],['oldCode','Código anterior de la prenda',['codigo anterior','codigo','sku','articulo','codproducto']],['oldBarcode','Código de barras anterior (opcional)',['codigo de barras anterior','codbarra','cod barra']],['desc','Descripción (opcional)',['descripcion','prenda','detalle']],['quantity','Cantidad (vacío = 1)',['cantidad','stock','unidades']],['received','Fecha original de recepción (opcional)',['fecha recepcion','recepcion','fecha ingreso','fecha']],['price','Precio anterior / de referencia (opcional)',['precio','precio venta','precio anterior']],['share','% para el proveedor (opcional)',['porcentaje proveedor','participacion','% proveedor']],['quality','Estado físico (opcional)',['estado fisico','calidad']],['brand','Marca (opcional)',['marca']],['size','Talle (opcional)',['talle']],['color','Color (opcional)',['color']],['notes','Observaciones (opcional)',['observaciones','notas']],['taxId','DNI/CUIT (opcional)',['dni','cuit','dni/cuit']],['email','Email (opcional)',['email','correo']],['phone','Teléfono (opcional)',['telefono','celular']]];
export const normalizeHeader=v=>String(v??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replaceAll('_',' ');
export function mappedRows(rows,mapping,headerIndex=0){
 return rows.slice(headerIndex+1).map((cells,index)=>{
  const out={line:headerIndex+index+2};for(const [key,col] of Object.entries(mapping)){if(col==='')continue;let v=cells[Number(col)]??'';
   if(v instanceof Date)v=v.toISOString().slice(0,10);
   if(key==='received'&&typeof v==='string'){const m=v.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(m)v=m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0')}
   if(['price','share','quantity'].includes(key)&&typeof v==='string'&&v.trim()){let t=v.trim().replace(/[$%\s]/g,'');if(t.includes(','))t=t.replaceAll('.','').replace(',','.');v=t}
   out[key]=v;
  }return out;
 }).filter(r=>Object.entries(r).some(([k,v])=>k!=='line'&&String(v??'').trim()));
}
