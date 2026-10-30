export const CHAT_NOTIFICATION_SOUND: Readonly<{repeats:number;volume:number;interval:number;duration:number}>;
export function scheduleChatNotificationSound(context:AudioContext,onFinished?:()=>void):()=>void;
