export function isHtmlAttachment({type='',name='',url=''}={}) {
  return /^(text\/html|application\/xhtml\+xml)(?:;|$)/i.test(type) || /\.(?:html?|xhtml)(?:[?#]|$)/i.test(name || url);
}
export function attachmentResponseHeaders(type,name='') {
  if (!isHtmlAttachment({type,name})) return {};
  const clean=String(name).split(/[\\/]/).pop().replace(/[\u0000-\u001f\u007f]/g,'').slice(0,180)||'arquivo.html';
  const encoded=encodeURIComponent(clean).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
  return {'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="arquivo.html"; filename*=UTF-8''${encoded}`,
    'Content-Security-Policy':"sandbox; default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",'X-Content-Type-Options':'nosniff'};
}
