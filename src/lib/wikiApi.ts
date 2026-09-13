import type { Category, WikiArticle } from '../types';
import { apiDelete, apiGet, apiPost, apiPut } from './apiClient';
import { localDatabase } from './localDatabase';

type CategoriesResponse = {
  data?: Category[];
};

type ArticlesResponse = {
  data?: WikiArticle[];
};

export type WikiCategoryInput = {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  parent_id?: string | null;
};

export async function getWikiData() {
  try {
    const [categoriesResponse, articlesResponse] = await Promise.all([
      apiGet<CategoriesResponse>('/wiki/categories'),
      apiGet<ArticlesResponse>('/wiki/articles?status=published&pageSize=1000'),
    ]);

    return {
      categories: categoriesResponse.data ?? [],
      articles: articlesResponse.data ?? [],
      source: 'api' as const,
    };
  } catch {
    const fallback = await localDatabase.getWikiData();
    return {
      categories: fallback.categories,
      articles: [],
      source: 'local' as const,
    };
  }
}

export async function recordWikiView(articleId: string) {
  const response = await apiPost<{ data?: WikiArticle }>(`/wiki/articles/${articleId}/view`, {});
  return response.data;
}

export async function toggleWikiLike(articleId: string) {
  const response = await apiPost<{ data?: { liked: boolean; article: WikiArticle } }>(`/wiki/articles/${articleId}/like`, {});
  return response.data;
}

export async function getWikiComments(articleId: string) {
  const response = await apiGet<{ data?: unknown[] }>(`/wiki/articles/${articleId}/comments`);
  return response.data ?? [];
}

export async function createWikiComment(articleId: string, content: string) {
  const response = await apiPost<{ data?: unknown }>(`/wiki/articles/${articleId}/comments`, { content });
  return response.data;
}

export async function getWikiLikers(articleId: string) {
  const response = await apiGet<{ data?: unknown[] }>(`/wiki/articles/${articleId}/likes`);
  return response.data ?? [];
}

export async function getWikiViewers(articleId: string) {
  const response = await apiGet<{ data?: unknown[] }>(`/wiki/articles/${articleId}/views`);
  return response.data ?? [];
}

export async function createWikiCategory(input: WikiCategoryInput) {
  const response = await apiPost<{ data?: Category }>('/wiki/categories', input);
  if (!response.data) throw new Error('Setor não criado');
  return response.data;
}

export async function updateWikiCategory(categoryId: string, input: WikiCategoryInput) {
  const response = await apiPut<{ data?: Category }>(`/wiki/categories/${categoryId}`, input);
  if (!response.data) throw new Error('Setor não atualizado');
  return response.data;
}

export async function deleteWikiCategory(categoryId: string) {
  await apiDelete(`/wiki/categories/${categoryId}`);
}
export async function deleteWikiArticle(articleId: string) {
  await apiDelete(`/wiki/articles/${articleId}`);
}


export async function createWikiArticle(input: {
  title: string;
  slug: string;
  content: string;
  format?: 'markdown' | 'html' | 'visual' | 'asciidoc';
  category_id?: string;
  status?: 'draft' | 'published';
  tags?: string[];
}) {
  const response = await apiPost<{ data?: WikiArticle }>('/wiki/articles', input);
  if (!response.data) throw new Error('Artigo não criado');
  return response.data;
}

export async function updateWikiArticle(articleId: string, input: {
  title?: string;
  slug?: string;
  content?: string;
  format?: 'markdown' | 'html' | 'visual' | 'asciidoc';
  category_id?: string;
  status?: 'draft' | 'published' | 'archived';
  tags?: string[];
}) {
  const response = await apiPut<{ data?: WikiArticle }>(`/wiki/articles/${articleId}`, input);
  if (!response.data) throw new Error('Artigo não atualizado');
  return response.data;
}

export async function setWikiCategoryVisibility(categoryId: string, allowedUserIds: string[] | null, roleRequired?: string | null) {
  const response = await apiPut<{ data?: { id: string; allowed_user_ids: string[] | null; role_required: string | null } }>(
    `/wiki/categories/${categoryId}/visibility`,
    { allowed_user_ids: allowedUserIds, role_required: roleRequired ?? null }
  );
  return response.data;
}

export async function setWikiArticleVisibility(articleId: string, roleRequired: string | null, allowedUserIds?: string[] | null) {
  return apiPut<{ data?: { id: string; role_required: string | null; allowed_user_ids: string[] | null } }>(
    `/wiki/articles/${articleId}/visibility`,
    { role_required: roleRequired, allowed_user_ids: allowedUserIds ?? null }
  );
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export interface WikiVersion {
  id: string;
  version_number: number;
  created_at: string;
  editor: { id: string; name: string; photo_url: string | null } | null;
}

export async function listWikiVersions(articleId: string): Promise<WikiVersion[]> {
  const response = await apiGet<{ data?: WikiVersion[] }>(`/wiki/articles/${articleId}/versions`);
  return response.data ?? [];
}

export async function uploadWikiMedia(file: File, wikiArticleId?: string) {
  const data = await readFileAsDataUrl(file);
  const response = await apiPost<{ data?: { public_url: string; file_name: string; file_type?: string } }>('/wiki/media', {
    file_name: file.name,
    file_type: file.type,
    data,
    wiki_article_id: wikiArticleId,
  });
  if (!response.data) throw new Error('Arquivo não enviado');
  return response.data;
}
