import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
export function HrAvatar({ name, photo }: { name: string; photo?: string | null }) {
  return <Avatar className="hr-avatar"><AvatarImage src={photo || undefined} alt="" className="object-cover" /><AvatarFallback className="hr-avatar-fallback">{name.split(' ').filter(Boolean).slice(0,2).map(part=>part[0]).join('')}</AvatarFallback></Avatar>;
}
