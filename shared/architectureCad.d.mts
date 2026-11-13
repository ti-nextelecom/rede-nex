export interface CadMetadata { format:'DWG';name:string;sha256:string;signature:string;size:number;entity_count:number;layer_count:number;omitted_count:number;warning_code:number;calibrated:boolean }
export interface CadView {name:string;box:number[]}
export const MAX_DWG_BYTES:number;
export const DWG_SIGNATURES:Readonly<Record<string,string>>;
export function inspectDwg(bytes:Uint8Array|ArrayBuffer,size?:number):{signature:string;version:string};
export function validateCadMetadata(value:unknown):CadMetadata;
export function cadViewports(database:{entities:unknown[]},svg:string):CadView[];
export function cadSvgForView(svg:string,box:number[],maximum?:number):string;
