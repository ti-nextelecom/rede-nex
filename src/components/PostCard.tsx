import React from 'react';
import { Heart, MessageCircle, Share2, MoreVertical } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { cn } from '../lib/utils';

interface PostCardProps {
  author: {
    id: string;
    name: string;
    avatar?: string;
    title?: string;
  };
  content: string;
  image?: string;
  media?: Array<{ type: 'image' | 'video'; url: string }>;
  timestamp: Date | string;
  likes?: number;
  comments?: number;
  shares?: number;
  liked?: boolean;
  onLike?: () => void;
  onComment?: () => void;
  onShare?: () => void;
  variant?: 'default' | 'glass' | 'gradient';
}

export const PostCard = React.forwardRef<HTMLDivElement, PostCardProps>(
  (
    {
      author,
      content,
      image,
      media,
      timestamp,
      likes = 0,
      comments = 0,
      shares = 0,
      liked = false,
      onLike,
      onComment,
      onShare,
      variant = 'default',
    },
    ref
  ) => {
    const formatDate = (date: Date | string) => {
      const d = typeof date === 'string' ? new Date(date) : date;
      const now = new Date();
      const diff = now.getTime() - d.getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'agora';
      if (mins < 60) return `${mins}m`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h`;
      const days = Math.floor(hours / 24);
      if (days < 7) return `${days}d`;
      return d.toLocaleDateString('pt-BR');
    };

    return (
      <Card
        ref={ref}
        variant={variant}
        className={cn(
          'overflow-hidden transition-all duration-300',
          variant === 'glass' && 'hover:border-white/40',
          variant === 'gradient' && 'hover:shadow-2xl hover:shadow-primary/30'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <Avatar glow size="md">
              <AvatarImage src={author.avatar} alt={author.name} />
              <AvatarFallback className="bg-gradient-primary text-white">
                {author.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <h3 className="font-semibold text-sm leading-none">{author.name}</h3>
              {author.title && (
                <p className="text-xs text-muted-foreground mt-1">{author.title}</p>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">{formatDate(timestamp)}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical size={16} />
          </Button>
        </div>

        {/* Content */}
        <div className="px-4 py-3">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
        </div>

        {/* Media */}
        {(image || media) && (
          <div className="overflow-hidden">
            {image && (
              <img
                src={image}
                alt="Post media"
                className="w-full h-auto max-h-96 object-cover"
              />
            )}
            {media && media.length > 0 && (
              <div className="grid gap-1 grid-cols-2">
                {media.map((m, i) => (
                  <div key={i} className="relative overflow-hidden bg-black/50">
                    {m.type === 'image' ? (
                      <img
                        src={m.url}
                        alt={`Media ${i}`}
                        className="w-full h-40 object-cover"
                      />
                    ) : (
                      <video
                        src={m.url}
                        className="w-full h-40 object-cover"
                        controls
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border/50 text-muted-foreground text-xs">
          <div className="flex items-center gap-4">
            {likes > 0 && <span className="font-medium">{likes} gostou</span>}
          </div>
          {comments > 0 && (
            <span className="font-medium">{comments} comentários</span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 px-2 py-2 border-t border-border/50">
          <Button
            variant="ghost"
            className={cn(
              'flex-1 h-8 text-sm font-medium transition-all',
              liked && 'text-primary'
            )}
            onClick={onLike}
          >
            <Heart
              size={16}
              className={cn(
                'mr-2 transition-all',
                liked && 'fill-current'
              )}
            />
            Gostei
          </Button>
          <Button
            variant="ghost"
            className="flex-1 h-8 text-sm font-medium"
            onClick={onComment}
          >
            <MessageCircle size={16} className="mr-2" />
            Comentar
          </Button>
          <Button
            variant="ghost"
            className="flex-1 h-8 text-sm font-medium"
            onClick={onShare}
          >
            <Share2 size={16} className="mr-2" />
            Compartilhar
          </Button>
        </div>
      </Card>
    );
  }
);

PostCard.displayName = 'PostCard';
