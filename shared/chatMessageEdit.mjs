/** Separate user-editable text from forwarding and attachment metadata. */
export function chatMessageEditParts(content) {
  const original = String(content ?? '');
  const forwarded = original.match(/^\[FWD:[^\n]*\]\r?\n/)?.[0] || '';
  const body = original.slice(forwarded.length);
  if (/^\[(?:IMAGE|VIDEO|AUDIO_MSG|AUDIO|DOC(?:\|[^\]]*)?|FILE)\]/.test(body)) {
    const newline = body.indexOf('\n');
    return {
      kind: 'attachment',
      prefix: forwarded + (newline < 0 ? body : body.slice(0, newline).replace(/\r$/, '')),
      text: newline < 0 ? '' : body.slice(newline + 1),
    };
  }
  if (body.startsWith('[STICKER]')) {
    return { kind: 'sticker', prefix: forwarded + '[STICKER]', text: body.slice(9) };
  }
  return { kind: 'text', prefix: forwarded, text: body };
}

export function applyChatMessageEdit(original, text) {
  const parts = chatMessageEditParts(original);
  const edited = String(text ?? '').replace(/\u0000/g, '').trim();
  if (edited.length > 8000) throw Error('A mensagem pode ter até 8.000 caracteres.');
  if (parts.kind === 'attachment') return parts.prefix + (edited ? '\n' + edited : '');
  if (!edited) throw Error('Escreva uma mensagem antes de salvar.');
  return parts.prefix + edited;
}
