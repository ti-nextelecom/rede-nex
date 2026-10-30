import { useRef,useState } from 'react';
import { BellRing,X } from 'lucide-react';
import { AccessibleModal } from './AccessibleModal';
import { requestChatAttention,type ChatMessage } from '../lib/chatApi';
export function ChatAttentionDialog({conversationId,name,group,message,onClose,onSent}: {
  conversationId:string;name:string;group:boolean;message:ChatMessage;onClose:()=>void;onSent:(count:number)=>void;
}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const lock=useRef(false);
  return <AccessibleModal title='Chamar atenção' onClose={()=>{if(!lock.current)onClose();}} className='chat-attention-dialog'>
    <header><BellRing size={25}/><h2>Chamar atenção</h2><button onClick={onClose} disabled={busy} aria-label='Fechar'><X size={22}/></button></header>
    <p>{group?<>Os outros participantes ativos de <strong>{name}</strong> receberão</>:<><strong>{name}</strong> receberá</>} um aviso destacado para abrir esta mensagem.</p>
    <blockquote className='chat-attention-preview'><strong>{message.sender?.name || 'Mensagem selecionada'}</strong><span>{message.content.startsWith('[')?'Mídia ou arquivo':message.content}</span></blockquote>
    <small>Um chamado por minuto nesta conversa. O aviso do computador depende da autorização do destinatário.</small>
    {error && <p role='alert'>{error}</p>}
    <footer><button disabled={busy} onClick={onClose}>Escolher outra</button><button disabled={busy || message.is_deleted} onClick={async()=>{
      if(lock.current)return;lock.current=true;setBusy(true);setError('');
      try{const result=await requestChatAttention(conversationId,message.id);onSent(result.recipient_count);}
      catch(e){setError(e instanceof Error?e.message:'Não foi possível enviar');}finally{lock.current=false;setBusy(false);}
    }}><BellRing size={18}/>{busy?'Enviando…':'Chamar atenção'}</button></footer>
  </AccessibleModal>;
}
