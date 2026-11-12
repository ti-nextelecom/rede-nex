import type {PushNotificationsPlugin} from '@capacitor/push-notifications';
import type {AppPlugin} from '@capacitor/app';
export function nativePushLink(value:unknown):string|null;
export function startNativePushRegistration(options:{push:Pick<PushNotificationsPlugin,'addListener'|'checkPermissions'|'requestPermissions'|'createChannel'|'register'>;app:Pick<AppPlugin,'addListener'|'getLaunchUrl'>;saveToken:(token:string)=>Promise<unknown>;navigate:(path:string)=>void;onError?:(phase:string)=>void;onDenied?:()=>void;onSaved?:()=>void;timers?:Pick<typeof globalThis,'setTimeout'|'clearTimeout'>}):{ready:Promise<void>;retry():Promise<void>;stop():void};
