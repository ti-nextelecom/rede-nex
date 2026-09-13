export type MediaBucket = 'avatars' | 'post-media' | 'wiki-attachments' | 'training-media';
export type MediaContext = 'avatar' | 'cover' | 'post' | 'wiki' | 'training' | 'general';

interface UploadMediaOptions {
  bucket: MediaBucket;
  context: MediaContext;
  file: File;
  ownerId?: string;
  postId?: string;
  wikiArticleId?: string;
  trainingId?: string;
}

function safeFileName(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

export async function uploadMedia({
  bucket,
  context,
  file,
  ownerId,
  postId,
  wikiArticleId,
  trainingId,
}: UploadMediaOptions) {
  const folder = ownerId || 'shared';
  const path = `${context}/${folder}/${crypto.randomUUID()}-${safeFileName(file.name)}`;

  return {
    id: crypto.randomUUID(),
    bucket,
    path,
    public_url: URL.createObjectURL(file),
    file_name: file.name,
    file_type: file.type,
    file_size: file.size,
    owner_id: ownerId,
    context,
    post_id: postId,
    wiki_article_id: wikiArticleId,
    training_id: trainingId,
    created_at: new Date().toISOString(),
  };
}
