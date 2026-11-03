import { Fragment, useMemo } from 'react';
import { chatTextParts, type MentionMatcher } from '../../shared/chatMentions.mjs';
import './link-text.css';

/** Linkify plain text at render time: old/new messages keep their original data.
 * Never evaluates pasted HTML, fetches link previews, or accepts executable URLs.
 */
export function LinkText({ text, mentionMatcher, onMention }: { text: string; mentionMatcher?: MentionMatcher; onMention?:(userId:string)=>void }) {
  const parts=useMemo(()=>chatTextParts(text,mentionMatcher),[text,mentionMatcher]);
  return <>{parts.map((part, index) => part.kind === 'link'
    ? <a key={index} className="nex-text-link" href={part.href} target="_blank" rel="noopener noreferrer ugc" title={part.href} aria-label={`${part.text} (abrir em nova aba)`} onClick={event => event.stopPropagation()}>{part.text}</a>
    : part.kind === 'mention' && part.userId === '__todos__'
    ? <span key={index} className='nex-user-mention nex-mention-todos'>{part.text}</span>
    : part.kind === 'mention' && onMention
    ? <button key={index} type='button' className='nex-user-mention' title={`Ver perfil de ${part.text.slice(1)}`} aria-label={`Ver perfil de ${part.text.slice(1)}`} onClick={event=>{event.stopPropagation();onMention(part.userId);}}>{part.text}</button>
    : <Fragment key={index}>{part.text}</Fragment>)}</>;
}
