export function isHtmlAttachment(asset?: {type?:string;name?:string;url?:string}): boolean;
export function attachmentResponseHeaders(type:string,name?:string): Record<string,string>;
