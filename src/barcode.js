import JsBarcode from 'jsbarcode';
export function barcodeSvg(code,{displayValue=true}={}){
 if(!/^THR-\d+$/.test(code))throw Error('Código de prenda inválido');
 const encoded={};JsBarcode(encoded,code,{format:'CODE128',displayValue:false});
 const bits=encoded.encodings.map(e=>e.data).join(''),quiet=20,width=bits.length*2+quiet*2;
 const height=displayValue?116:92;
 let bars='';for(let x=0;x<bits.length;x++)if(bits[x]==='1')bars+=`<rect x="${quiet+x*2}" y="10" width="2" height="72"/>`;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Código de barras ${code}" shape-rendering="crispEdges"><rect width="${width}" height="${height}" fill="white"/><g fill="black">${bars}</g>${displayValue?`<text x="${width/2}" y="104" text-anchor="middle" fill="black" font-family="monospace" font-size="16">${code}</text>`:''}</svg>`;
}
