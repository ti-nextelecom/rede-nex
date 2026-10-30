export type ChatRequest = {conversationId:string|null;generation:number;sequence:number;channel:string};
export function createChatRequestGuard(initialConversationId?:string|null): {
  select(id:string|null):void;
  capture(id:string|null,channel?:string):ChatRequest;
  isCurrent(request:ChatRequest):boolean;
  accept(request:ChatRequest):boolean;
};
