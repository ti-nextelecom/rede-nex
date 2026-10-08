/**
 * Exemplo de Feed Modernizado
 * Demonstra o uso dos novos componentes com design futurista
 */

import React, { useState } from 'react';
import { PostCard } from '@/components/PostCard';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Heart, Share2, MessageCircle, MoreVertical, Zap } from 'lucide-react';

interface Post {
  id: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
    title?: string;
  };
  content: string;
  image?: string;
  timestamp: Date;
  likes: number;
  comments: number;
  liked?: boolean;
}

interface FeedProps {
  posts?: Post[];
  isLoading?: boolean;
  onPostCreate?: (content: string) => void;
}

export function ModernFeed({ posts = [], isLoading = false, onPostCreate }: FeedProps) {
  const [newPost, setNewPost] = useState('');
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());

  const handleCreatePost = () => {
    if (newPost.trim()) {
      onPostCreate?.(newPost);
      setNewPost('');
    }
  };

  const toggleLike = (postId: string) => {
    const updated = new Set(likedPosts);
    if (updated.has(postId)) {
      updated.delete(postId);
    } else {
      updated.add(postId);
    }
    setLikedPosts(updated);
  };

  return (
    <div className="w-full max-w-2xl mx-auto py-4 px-4 space-y-4">
      {/* Stories Bar (opcional) */}
      <Card variant="glass" className="p-4 overflow-hidden">
        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
          {Array.from({ length: 8 }).map((_, i) => (
            <button
              key={i}
              className="flex-shrink-0 relative group cursor-pointer"
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/50 to-primary/20 p-0.5 group-hover:from-primary/70 group-hover:to-primary/40 transition-all">
                <div className="w-full h-full rounded-full bg-card flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">+</span>
                </div>
              </div>
              <span className="text-[10px] text-center mt-1 w-16 truncate text-text-secondary">
                Usuário {i}
              </span>
            </button>
          ))}
        </div>
      </Card>

      {/* Create Post Card */}
      <Card variant="gradient" className="p-6 space-y-4">
        <div className="flex items-start gap-4">
          <Avatar glow size="md">
            <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=User" />
            <AvatarFallback className="bg-gradient-primary text-white">U</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <Input
              variant="glass"
              placeholder="No que você está pensando?"
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              className="mb-3"
            />
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-2">
                <Badge variant="glass">📸 Foto</Badge>
                <Badge variant="glass">🎬 Vídeo</Badge>
                <Badge variant="glass">😊 Emoji</Badge>
              </div>
              <Button
                variant="gradient-primary"
                size="sm"
                onClick={handleCreatePost}
                disabled={!newPost.trim()}
              >
                <Zap size={14} className="mr-2" />
                Postar
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Posts Feed */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin">
              <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full" />
            </div>
          </div>
        ) : posts.length > 0 ? (
          posts.map((post) => (
            <PostCard
              key={post.id}
              variant="glass"
              author={post.author}
              content={post.content}
              image={post.image}
              timestamp={post.timestamp}
              likes={post.likes}
              comments={post.comments}
              liked={likedPosts.has(post.id)}
              onLike={() => toggleLike(post.id)}
              onComment={() => console.log('Comment on', post.id)}
              onShare={() => console.log('Share', post.id)}
            />
          ))
        ) : (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Nada por aqui ainda</h3>
            <p className="text-sm text-text-secondary">
              Comece a seguir pessoas para ver seu feed!
            </p>
          </div>
        )}
      </div>

      {/* Load More */}
      {posts.length > 0 && (
        <div className="flex justify-center">
          <Button variant="glass" className="w-full">
            Carregar mais posts
          </Button>
        </div>
      )}
    </div>
  );
}

export default ModernFeed;
