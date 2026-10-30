import { useRef,useState } from 'react';
import { SmilePlus } from 'lucide-react';
import { CHAT_REACTIONS } from '../../shared/chatReactions.mjs';
import type { ChatReaction } from '../lib/chatApi';
import { Popover,PopoverContent,PopoverTrigger } from './ui/popover';

export function ChatMessageReactions({reactions,mine,onReact}: {
  reactions:ChatReaction[];mine:boolean;onReact:(emoji:string|null)=>Promise<void>;
}) {
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const lock=useRef(false);
  const current=reactions.find(reaction=>reaction.mine)?.emoji;
  async function choose(emoji:string) {
    if(lock.current)return;lock.current=true;setBusy(true);setError('');
    try{await onReact(current===emoji?null:emoji);setOpen(false);}
    catch(e){setError(e instanceof Error?e.message:'Não foi possível salvar a reação.');}
    finally{lock.current=false;setBusy(false);}
  }
  return <div className='chat-message-reactions' data-picker-open={open || undefined} aria-label='Reações da mensagem'>
    {reactions.map(reaction=><button key={reaction.emoji} type='button' className='chat-reaction-chip' disabled={busy} aria-pressed={reaction.mine}
      title={`${reaction.users.map(user=>user.name).join(', ')}${reaction.mine?' · Clique para remover sua reação':''}`}
      aria-label={`${reaction.emoji}: ${reaction.count} reação(ões)${reaction.mine?', você reagiu':''}`}
      onClick={()=>void choose(reaction.emoji)}><span>{reaction.emoji}</span><b>{reaction.count}</b></button>)}
    <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild>
      <button type='button' className='chat-reaction-add' disabled={busy} aria-label='Reagir à mensagem' title='Reagir à mensagem'><SmilePlus size={18}/></button>
    </PopoverTrigger><PopoverContent align={mine?'end':'start'} side='top' sideOffset={8} className='chat-reaction-picker'>
      <p>Reagir à mensagem</p><div>{CHAT_REACTIONS.map(emoji=><button type='button' key={emoji} disabled={busy} aria-pressed={current===emoji} aria-label={`Reagir com ${emoji}`} onClick={()=>void choose(emoji)}>{emoji}</button>)}</div>
      <small>Escolha outro emoji para trocar. Toque na sua reação para removê-la.</small>
    </PopoverContent></Popover>
    {error && <p role='alert' className='chat-reaction-error'>{error}</p>}
  </div>;
}
