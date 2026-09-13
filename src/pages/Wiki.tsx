import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import DOMPurify from 'dompurify';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  Bold,
  BookMarked,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Code2,
  DollarSign,
  Edit3,
  Eye,
  FileText,
  Folder,
  Globe,
  Headphones,
  Heart,
  History,
  Image as ImageIcon,
  Italic,
  Link,
  List,
  ListTree,
  ListOrdered,
  MessageSquare,
  Minus,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Save,
  Search,
  Send,
  Star,
  Tag,
  Table,
  TrendingUp,
  Trash2,
  Underline,
  Users,
  Video,
  Wrench,
  Lock,
  LockOpen,
  Paperclip,
  X,
  ExternalLink,
  Archive,
  Award,
  Bell,
  Box,
  Briefcase,
  Building2,
  Cpu,
  Layers,
  Monitor,
  Package,
  Settings,
  Shield,
  Truck,
  Zap,
} from 'lucide-react';
import {
  createWikiCategory,
  createWikiArticle,
  createWikiComment,
  deleteWikiCategory,
  deleteWikiArticle,
  getWikiComments,
  getWikiData,
  getWikiLikers,
  getWikiViewers,
  recordWikiView,
  toggleWikiLike,
  updateWikiCategory,
  updateWikiArticle,
  setWikiArticleVisibility,
  uploadWikiMedia,
  listWikiVersions,
  setWikiCategoryVisibility,
} from '../lib/wikiApi';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import type { Category, WikiArticle } from '../types';
import { cn } from '../lib/utils';
import { useAuth } from '../lib/auth';
pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

interface CategoryWithArticles extends Category {
  _articles: WikiArticle[];
  _open: boolean;
}

type ViewMode = 'home' | 'article' | 'edit' | 'new';
type EditorTab = 'write' | 'preview';
type EditorChoice = 'visual' | 'markdown' | 'html' | 'asciidoc';

type CategoryDraft = {
  name: string;
  description: string;
  color: string;
  icon: string;
};

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface WikiComment {
  id: string;
  content: string;
  created_at: string;
  users?: { name: string; photo_url?: string };
}

interface WikiUserEntry {
  user_id: string;
  created_at: string;
  users?: { id: string; name: string; photo_url?: string };
}

const CATEGORY_ICONS: Record<string, typeof Headphones> = {
  Atendimento: Headphones,
  'Suporte Técnico': Wrench,
  NOC: Network,
  Financeiro: DollarSign,
  Comercial: TrendingUp,
  RH: Users,
};

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>> = {
  folder: Folder,
  headphones: Headphones,
  network: Network,
  'dollar-sign': DollarSign,
  'trending-up': TrendingUp,
  users: Users,
  wrench: Wrench,
  'book-open': BookOpen,
  'file-text': FileText,
  star: Star,
  heart: Heart,
  globe: Globe,
  tag: Tag,
  'message-square': MessageSquare,
  'list-tree': ListTree,
  'check-circle': CheckCircle2,
  'book-marked': BookMarked,
  archive: Archive,
  award: Award,
  bell: Bell,
  box: Box,
  briefcase: Briefcase,
  building: Building2,
  cpu: Cpu,
  layers: Layers,
  monitor: Monitor,
  package: Package,
  settings: Settings,
  shield: Shield,
  truck: Truck,
  zap: Zap,
};


const fallbackCategories: Category[] = [
  {
    id: 'wiki-atendimento',
    name: 'Atendimento',
    description: 'Processos de atendimento ao cliente',
    icon: 'Headphones',
    color: '#ff7a00',
    type: 'wiki',
    created_at: new Date().toISOString(),
  },
  {
    id: 'wiki-suporte',
    name: 'Suporte Técnico',
    description: 'Documentação técnica de rede e equipamentos',
    icon: 'Wrench',
    color: '#0057b8',
    type: 'wiki',
    created_at: new Date().toISOString(),
  },
  {
    id: 'wiki-financeiro',
    name: 'Financeiro',
    description: 'Cobrança, negociação e processos financeiros',
    icon: 'DollarSign',
    color: '#9333ea',
    type: 'wiki',
    created_at: new Date().toISOString(),
  },
];

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function stripMarkdown(value?: string) {
  return (value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#*`|>[\]()-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function timeAgo(dateStr: string) {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (days <= 0) return 'hoje';
  if (days === 1) return 'ontem';
  if (days < 30) return `${days} dias atrás`;
  return formatDate(dateStr);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const DOMPURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'a', 'blockquote', 'br', 'caption', 'code', 'col', 'colgroup', 'details', 'div', 'em',
    'figure', 'figcaption', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'hr', 'iframe', 'img', 'li', 'ol', 'p', 'pre', 'span', 'strong',
    'summary', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'ul', 'video', 'source',
  ],
  ALLOWED_ATTR: [
    'allow', 'allowfullscreen', 'alt', 'class', 'colspan', 'controls',
    'frameborder', 'height', 'href', 'id', 'loading', 'rel',
    'rowspan', 'sandbox', 'src', 'style', 'target', 'title', 'width',
  ],
  ALLOW_DATA_ATTR: false,
  FORCE_BODY: false,
};

function sanitizeWikiHtml(value: string) {
  const withImportedHtml = value
    .replace(/&lt;(\/?[a-zA-Z0-9-]+)(.*?)&gt;/g, '<$1$2>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;nbsp;/g, ' ')
    .replace(/&amp;amp;/g, '&amp;')
    .replace(/&amp;lt;/g, '&lt;')
    .replace(/&amp;gt;/g, '&gt;');
  return DOMPurify.sanitize(withImportedHtml, DOMPURIFY_CONFIG);
}

function renderMdTable(block: string): string | null {
  const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2 || !lines.every(l => l.startsWith('|') && l.endsWith('|'))) return null;
  const isSep = (l: string) => /^\|[-:\| ]+\|$/.test(l);
  const sepIdx = lines.findIndex(isSep);
  if (sepIdx === -1) return null;
  const parseRow = (row: string) => row.split('|').slice(1, -1).map(c => c.trim());
  const thead = lines.slice(0, sepIdx)
    .map(r => `<tr>${parseRow(r).map(c => `<th>${c}</th>`).join('')}</tr>`)
    .join('');
  const tbody = lines.slice(sepIdx + 1).filter(l => !isSep(l))
    .map(r => `<tr>${parseRow(r).map(c => `<td>${c}</td>`).join('')}</tr>`)
    .join('');
  return `<div class="wiki-table-wrap"><table class="wiki-table"><thead>${thead}</thead><tbody>${tbody}</tbody></table></div>`;
}


function getEmbedInfo(url: string): { embedUrl: string; type: 'youtube' | 'drive' | 'vimeo' | null } {
  if (!url) return { embedUrl: '', type: null };
  const ytMatch = url.match(/(?:youtube\.com\/watch[^\s]*[?&]v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (ytMatch) return { embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}?rel=0`, type: 'youtube' };
  const driveViewMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveViewMatch) return { embedUrl: `https://drive.google.com/file/d/${driveViewMatch[1]}/preview`, type: 'drive' };
  const driveOpenMatch = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (driveOpenMatch) return { embedUrl: `https://drive.google.com/file/d/${driveOpenMatch[1]}/preview`, type: 'drive' };
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return { embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`, type: 'vimeo' };
  return { embedUrl: url, type: null };
}

function renderMarkdown(markdown: string) {
  if (!markdown) return '';
  let headingIndex = 0;

  const rendered = escapeHtml(markdown)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g, (_, alt, src, title) =>
      `<img class="wiki-media-image" src="${src}" alt="${alt || ''}"${title ? ` title="${title}"` : ''} />`
    )
    .replace(/\[video:([^\]\s]+)\]/g, (_, src) =>
      `<video class="wiki-media-video" src="${src}" controls></video>`
    )
    .replace(/^(https?:\/\/\S*(?:youtube\.com\/watch|youtu\.be\/|drive\.google\.com\/(?:file\/d\/|open\?id=)|vimeo\.com\/\d)\S*)$/gm, (_, url) => {
      const ei = getEmbedInfo(url.trim());
      if (!ei.type) return url;
      return `<div style="position:relative;width:100%;padding-bottom:56.25%;margin:1rem 0"><iframe src="${ei.embedUrl}" style="position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:8px" allowfullscreen allow="autoplay; encrypted-media; fullscreen" loading="lazy" title="Vídeo incorporado"></iframe></div>`;
    })
    .replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]+")?\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    )
    .replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) =>
      `<pre class="wiki-code"><div class="wiki-code-label">${lang || 'code'}</div><code>${code}</code></pre>`
    )
    .replace(/^### (.+)$/gm, (_, title) => {
      const id = `${slugify(title)}-${headingIndex++}`;
      return `<h3 id="${id}">${title}</h3>`;
    })
    .replace(/^## (.+)$/gm, (_, title) => {
      const id = `${slugify(title)}-${headingIndex++}`;
      return `<h2 id="${id}">${title}</h2>`;
    })
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="wiki-inline-code">$1</code>')
    .replace(/^---$/gm, '<hr>')
    .replace(/^\d+\. (.+)$/gm, '<li class="wiki-ordered">$1</li>')
    .replace(/^[-*] (.+)$/gm, '<li class="wiki-bullet">$1</li>')
    .split(/\n{2,}/)
    .map(block => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      if (/^<(h1|h2|h3|pre|hr|li|img|video|details|table|ul|ol|div|p|a)/.test(trimmed)) return trimmed;
      const tableHtml = renderMdTable(trimmed);
      if (tableHtml) return tableHtml;
      return `<p>${trimmed.replace(/\n/g, '<br />')}</p>`;
    })
    .join('');

  return sanitizeWikiHtml(wrapListItems(rendered));
}

function renderAsciiDoc(asciidoc: string) {
  if (!asciidoc) return '';
  let headingIndex = 0;

  const rendered = escapeHtml(asciidoc)
    .replace(/^==== (.+)$/gm, (_, title) => `<h4>${title}</h4>`)
    .replace(/^=== (.+)$/gm, (_, title) => `<h3 id="${slugify(title)}-${headingIndex++}">${title}</h3>`)
    .replace(/^== (.+)$/gm, (_, title) => `<h2 id="${slugify(title)}-${headingIndex++}">${title}</h2>`)
    .replace(/^= (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>')
    .replace(/_([^_\n]+)_/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="wiki-inline-code">$1</code>')
    .replace(/^----\n([\s\S]*?)\n----$/gm, (_, code) =>
      `<pre class="wiki-code"><div class="wiki-code-label">asciidoc</div><code>${code}</code></pre>`
    )
    .replace(/^image::([^[]+)[[](.*?)\]$/gm, (_, src, alt) =>
      `<img class="wiki-media-image" src="${src}" alt="${alt || ''}" />`
    )
    .replace(/^video::([^[]+)[[](.*?)\]$/gm, (_, src) =>
      `<video class="wiki-media-video" src="${src}" controls></video>`
    )
    .replace(/link:([^[]+)[[]([^]]+)\]/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$2</a>')
    .replace(/^\* (.+)$/gm, '<li class="wiki-bullet">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="wiki-ordered">$1</li>')
    .replace(/^'''$/gm, '<hr>')
    .split(/\n{2,}/)
    .map(block => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      if (/^<(h1|h2|h3|h4|pre|hr|li|img|video|table|ul|ol|div|p)/.test(trimmed)) return trimmed;
      return `<p>${trimmed.replace(/\n/g, '<br />')}</p>`;
    })
    .join('');

  return sanitizeWikiHtml(rendered);
}

function renderEditorPreview(content: string, editorChoice: EditorChoice) {
  if (editorChoice === 'html' || editorChoice === 'visual') return sanitizeWikiHtml(content);
  if (editorChoice === 'asciidoc') return renderAsciiDoc(content);
  return renderMarkdown(content);
}

function extractToc(markdown?: string): TocItem[] {
  if (!markdown) return [];

  return Array.from(markdown.matchAll(/^(#{2,3})\s+(.+)$/gm)).map((match, index) => {
    const text = match[2].replace(/[*`]/g, '').trim();
    return {
      id: `${slugify(text)}-${index}`,
      text,
      level: match[1].length,
    };
  });
}

function removeLeadingTitle(markdown: string) {
  let result = markdown.replace(/^#\s+.+(?:\r?\n){0,2}/, '');
  result = result.replace(/^\s*<h1[^>]*>[\s\S]*?<\/h1>\s*/i, '');
  return result.trim();
}

function wrapListItems(html: string): string {
  return html
    .replace(/(<li class="wiki-bullet">.*?<\/li>(\s*<li class="wiki-bullet">.*?<\/li>)*)/gs,
      match => `<ul class="wiki-ul">${match.trim()}</ul>`)
    .replace(/(<li class="wiki-ordered">.*?<\/li>(\s*<li class="wiki-ordered">.*?<\/li>)*)/gs,
      match => `<ol class="wiki-ol">${match.trim()}</ol>`);
}

export function Wiki() {
  const [categories, setCategories] = useState<CategoryWithArticles[]>([]);
  const [allArticles, setAllArticles] = useState<WikiArticle[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<WikiArticle | null>(null);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('home');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 768);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editTab, setEditTab] = useState<EditorTab>('write');
  const [newEditorChoice, setNewEditorChoice] = useState<EditorChoice | null>(null);
  const [newArticleTitle, setNewArticleTitle] = useState('');
  const [newArticleCat, setNewArticleCat] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft>({
    name: '',
    description: '',
    color: '#0057b8',
    icon: 'Folder',
  });
  const [categorySaving, setCategorySaving] = useState(false);
  const [articleRoleRequired, setArticleRoleRequired] = useState<string | null>(null);
  const { user } = useAuth();
  const isAdmin = user?.role_name === 'Administrador';
  const isAdminOrGestor = isAdmin || user?.role_name === 'Gestor';
  const [visibilityModal, setVisibilityModal] = useState<CategoryWithArticles | null>(null);
  const [visibilityUsers, setVisibilityUsers] = useState<{ id: string; name: string; photo_url?: string | null }[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [visibilityLoading, setVisibilityLoading] = useState(false);
  const [visibilitySearch, setVisibilitySearch] = useState('');
  const [visibilityCategoryRole, setVisibilityCategoryRole] = useState<string | null>(null);
  const [articleAllowedUserIds, setArticleAllowedUserIds] = useState<string[]>([]);
  const [articleVisibilityOpen, setArticleVisibilityOpen] = useState(false);
  const [newCategoryParentId, setNewCategoryParentId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialUrlRef = useRef(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (viewMode === 'home' && initialUrlRef.current) {
      setSearchParams({}, { replace: true });
    }
  }, [viewMode]);

  useEffect(() => {
    if (!loading && allArticles.length > 0 && !initialUrlRef.current) {
      initialUrlRef.current = true;
      const artigo = searchParams.get('artigo');
      if (artigo) {
        const found = allArticles.find(a => a.id === artigo);
        if (found) openArticle(found);
      }
    }
  }, [loading, allArticles.length]);

  async function loadData() {
    setLoading(true);
    try {
      const result = await getWikiData();
      const dbCategories = result.categories.length ? result.categories : fallbackCategories;
      const dbArticles = result.articles || [];
      setAllArticles(dbArticles);
      setCategories(dbCategories.map(category => ({
        ...category,
        _articles: dbArticles.filter(article => article.category_id === category.id),
        _open: true,
      })));
    } finally {
      setLoading(false);
    }
  }

  const visibleCategories = useMemo(() => {
    if (!selectedCat) return categories;
    return categories.filter(category => category.name === selectedCat);
  }, [categories, selectedCat]);

  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];

    return allArticles.filter(article =>
      article.title.toLowerCase().includes(query) ||
      stripMarkdown(article.content).toLowerCase().includes(query) ||
      article.content?.toLowerCase().includes(query) ||
      article.tags?.some(tag => tag.toLowerCase().includes(query)) ||
      article.categories?.name.toLowerCase().includes(query)
    );
  }, [allArticles, search]);

  const recentlyUpdated = [...allArticles]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 5);

  function syncArticle(article: WikiArticle) {
    setSelectedArticle(article);
    setAllArticles(current => {
      const exists = current.some(item => item.id === article.id);
      return exists ? current.map(item => item.id === article.id ? article : item) : [article, ...current];
    });
    setCategories(current => current.map(category => {
      const withoutCurrent = category._articles.filter(item => item.id !== article.id);
      return {
        ...category,
        _articles: article.category_id === category.id ? [article, ...withoutCurrent] : withoutCurrent,
      };
    }));
  }

  function openArticle(article: WikiArticle) {
    setSearch('');
    setSelectedArticle(article);
    setViewMode('article');
    setSearchParams({ artigo: article.id }, { replace: true });
    if (window.innerWidth < 768 || article.format === 'html') setSidebarOpen(false);
    recordWikiView(article.id)
      .then(updated => {
        if (updated) syncArticle(updated);
      })
      .catch(() => undefined);
  }

  function openEdit(article: WikiArticle) {
    setSearch('');
    setSelectedArticle(article);
    setEditTitle(article.title);
    setEditContent(article.content || '');
    setEditTab('write');
    const fmt = article.format ?? 'markdown';
    setNewEditorChoice(fmt === 'visual' ? 'visual' : fmt === 'html' ? 'html' : fmt === 'asciidoc' ? 'asciidoc' : 'markdown');
    setArticleRoleRequired(article.role_required ?? null);
    setArticleAllowedUserIds(article.allowed_user_ids ?? []);
    setViewMode('edit');
  }

  function openNew() {
    setSearch('');
    setSelectedArticle(null);
    setEditTitle('');
    setEditContent('');
    setNewEditorChoice(null);
    setNewArticleTitle('');
    setNewArticleCat(categories[0]?.id || '');
    setEditTab('write');
    setArticleRoleRequired(null);
    setArticleAllowedUserIds([]);
    setViewMode('new');
  }

  function chooseNewEditor(choice: EditorChoice) {
    setNewEditorChoice(choice);
    setEditTab('write');

    if (choice === 'markdown') {
      setEditContent(`# Header

Your content here
`);
    }

    if (choice === 'visual') {
      setEditContent('');
    }

    if (choice === 'html') {
      setEditContent(`<h1>Title</h1>

<p>Some text here</p>
`);
    }

    if (choice === 'asciidoc') {
      setEditContent(`== header

content
`);
    }
  }

  async function deleteSelectedArticle() {
    if (!selectedArticle) return;
    try {
      await deleteWikiArticle(selectedArticle.id);
      setSelectedArticle(null);
      setViewMode('home');
      await loadData();
    } catch {
      alert('Erro ao apagar artigo. Tente novamente.');
    }
  }

  async function likeArticle(article: WikiArticle) {
    const result = await toggleWikiLike(article.id).catch(() => null);
    if (result?.article) syncArticle(result.article);
  }

  async function saveArticle() {
    const title = (viewMode === 'new' ? newArticleTitle : editTitle).trim();
    if (!title) return;

    const currentFormat = (newEditorChoice || 'markdown') as WikiArticle['format'];
    const baseSlug = selectedArticle?.slug || slugify(title);
    const payload = {
      title,
      slug: baseSlug,
      content: editContent,
      format: currentFormat,
      category_id: viewMode === 'new' ? newArticleCat || undefined : selectedArticle?.category_id,
      status: 'published' as const,
      tags: Array.from(new Set([
        ...title.toLowerCase().split(/\s+/).filter(word => word.length > 3).slice(0, 4),
        ...(selectedArticle?.tags || []),
      ])),
    };

    async function persist(p: typeof payload) {
      const saved = selectedArticle
        ? await updateWikiArticle(selectedArticle.id, p)
        : await createWikiArticle(p);
      const roleChanged = articleRoleRequired !== (selectedArticle?.role_required ?? null);
      const usersChanged = JSON.stringify([...(articleAllowedUserIds)].sort()) !== JSON.stringify([...(selectedArticle?.allowed_user_ids ?? [])].sort());
      if (roleChanged || usersChanged) {
        await setWikiArticleVisibility(saved.id, articleRoleRequired, articleAllowedUserIds.length ? articleAllowedUserIds : null).catch(() => {});
      }
      syncArticle({ ...saved, role_required: articleRoleRequired, allowed_user_ids: articleAllowedUserIds.length ? articleAllowedUserIds : null });
      setViewMode('article');
    }

    try {
      await persist(payload);
    } catch (err: unknown) {
      const msg = String((err as { message?: string }).message ?? err);
      if (!selectedArticle && (msg.includes('409') || msg.includes('slug') || msg.includes('unique') || msg.includes('23505') || msg.toLowerCase().includes('duplic'))) {
        try {
          await persist({ ...payload, slug: `${baseSlug}-${Date.now()}` });
        } catch {
          alert('Erro ao criar artigo. Tente novamente com outro título.');
        }
      } else {
        alert(`Erro ao salvar artigo: ${msg}`);
      }
    }
  }

  async function uploadAndInsertMedia(file: File) {
    return uploadWikiMedia(file, selectedArticle?.id);
  }

  function startNewCategory(parentId: string | null = null) {
    setEditingCategoryId('new');
    setNewCategoryParentId(parentId);
    setCategoryDraft({
      name: '',
      description: '',
      color: '#0057b8',
      icon: 'Folder',
    });
  }

  function startEditCategory(category: CategoryWithArticles) {
    setEditingCategoryId(category.id);
    setCategoryDraft({
      name: category.name,
      description: category.description || '',
      color: category.color || '#0057b8',
      icon: category.icon || 'Folder',
    });
  }

  function cancelCategoryEdit() {
    setEditingCategoryId(null);
    setNewCategoryParentId(null);
    setCategoryDraft({
      name: '',
      description: '',
      color: '#0057b8',
      icon: 'Folder',
    });
  }

  async function openVisibilityModal(category: CategoryWithArticles) {
    setVisibilityModal(category);
    setSelectedUserIds(category.allowed_user_ids || []);
    setVisibilityCategoryRole(category.role_required ?? null);
    setVisibilitySearch('');
    if (visibilityUsers.length === 0) {
      try {
        const apiBase = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
        const res = await fetch(apiBase + '/users?status=active&pageSize=500', { credentials: 'include' });
        const json = await res.json();
        setVisibilityUsers((json.data || []).sort((a, b) => a.name.localeCompare(b.name)));
        setVisibilitySearch('');
      } catch {}
    }
  }

  async function saveVisibility() {
    if (!visibilityModal || visibilityLoading) return;
    setVisibilityLoading(true);
    try {
      await setWikiCategoryVisibility(visibilityModal.id, selectedUserIds.length ? selectedUserIds : null, visibilityCategoryRole);
      setCategories(current =>
        current.map(cat =>
          cat.id === visibilityModal.id
            ? { ...cat, allowed_user_ids: selectedUserIds.length ? [...selectedUserIds] : null, role_required: visibilityCategoryRole }
            : cat
        )
      );
      setVisibilityModal(null);
    } finally {
      setVisibilityLoading(false);
    }
  }

  async function saveCategory() {
    const name = categoryDraft.name.trim();
    if (!name || categorySaving) return;

    setCategorySaving(true);
    try {
      const payload = {
        name,
        description: categoryDraft.description.trim() || undefined,
        color: categoryDraft.color || '#0057b8',
        icon: categoryDraft.icon || 'Folder',
        parent_id: newCategoryParentId ?? null,
      };

      if (editingCategoryId === 'new') {
        await createWikiCategory(payload);
      } else if (editingCategoryId) {
        await updateWikiCategory(editingCategoryId, payload);
      }

      cancelCategoryEdit();
      await loadData();
    } finally {
      setCategorySaving(false);
    }
  }

  async function removeCategory(category: CategoryWithArticles) {
    if (!window.confirm(`Remover o setor "${category.name}" da Wiki? Os artigos ficam salvos, mas sem setor vinculado.`)) return;

    await deleteWikiCategory(category.id);
    if (selectedCat === category.name) setSelectedCat(null);
    if (newArticleCat === category.id) setNewArticleCat(categories.find(item => item.id !== category.id)?.id || '');
    if (editingCategoryId === category.id) cancelCategoryEdit();
    await loadData();
  }

  return (
    <div className="wiki-shell -mx-2 md:-mx-4">
      <WikiHeader
        search={search}
        setSearch={setSearch}
        onNew={openNew}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      <div className="wiki-layout">
        {sidebarOpen && (
          <div className="wiki-sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
        )}
        <aside className={cn('wiki-sidebar', !sidebarOpen && 'wiki-sidebar-collapsed')}>
          <WikiSidebar
            categories={categories}
            loading={loading}
            selectedCat={selectedCat}
            setSelectedCat={(name) => {
              setSelectedCat(name);
              setViewMode('home');
              setSelectedArticle(null);
            }}
            editingCategoryId={editingCategoryId}
            categoryDraft={categoryDraft}
            categorySaving={categorySaving}
            setCategoryDraft={setCategoryDraft}
            onAddCategory={() => startNewCategory(null)}
            onAddSubcategory={(parentId: string) => startNewCategory(parentId)}
            newCategoryParentId={newCategoryParentId}
            onEditCategory={startEditCategory}
            onDeleteCategory={removeCategory}
            onSaveCategory={saveCategory}
            onCancelCategory={cancelCategoryEdit}
            isAdmin={isAdmin}
            onSetVisibility={openVisibilityModal}
          />
        </aside>

        <main className="wiki-main">
          {search.trim() ? (
            <SearchResults query={search} results={searchResults} onOpen={openArticle} onEdit={openEdit} onNew={openNew} />
          ) : viewMode === 'article' && selectedArticle ? (
            <ArticleView
              article={selectedArticle}
              toc={extractToc(selectedArticle.content)}
              onBack={() => setViewMode('home')}
              onEdit={() => openEdit(selectedArticle)}
              onLike={() => likeArticle(selectedArticle)}
              onDelete={isAdminOrGestor ? deleteSelectedArticle : undefined}
            />
          ) : viewMode === 'new' && !newEditorChoice ? (
            <EditorChoiceView
              onBack={() => setViewMode('home')}
              onSelect={chooseNewEditor}
            />
          ) : viewMode === 'edit' || viewMode === 'new' ? (
            <EditorView
              mode={viewMode}
              editorChoice={newEditorChoice || 'markdown'}
              article={selectedArticle}
              categories={categories}
              editContent={editContent}
              editTitle={editTitle}
              editTab={editTab}
              newArticleTitle={newArticleTitle}
              newArticleCat={newArticleCat}
              setEditContent={setEditContent}
              setEditTitle={setEditTitle}
              setEditTab={setEditTab}
              setNewArticleTitle={setNewArticleTitle}
              setNewArticleCat={setNewArticleCat}
              onChangeEditorChoice={setNewEditorChoice}
              articleRoleRequired={articleRoleRequired}
              setArticleRoleRequired={setArticleRoleRequired}
              articleAllowedUserIds={articleAllowedUserIds}
              onOpenArticleVisibility={() => {
                setArticleVisibilityOpen(true);
                if (visibilityUsers.length === 0) {
                  const apiBase = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
                  fetch(apiBase + '/users?status=active&pageSize=500', { credentials: 'include' })
                    .then(r => r.json())
                    .then(j => setVisibilityUsers((j.data || []).sort((a: {name:string}, b: {name:string}) => a.name.localeCompare(b.name))))
                    .catch(() => {});
                }
              }}
              onBack={() => {
                if (viewMode === 'new') {
                  setNewEditorChoice(null);
                  return;
                }

                setViewMode(selectedArticle ? 'article' : 'home');
              }}
              onSave={saveArticle}
              onUploadMedia={uploadAndInsertMedia}
            />
          ) : (
            <WikiHome
              categories={visibleCategories}
              allArticles={allArticles}
              loading={loading}
              selectedCat={selectedCat}
              setSelectedCat={setSelectedCat}
              recentlyUpdated={recentlyUpdated}
              onOpen={openArticle}
              onEdit={openEdit}
              onNew={openNew}
            />
          )}
        </main>
      </div>

      {visibilityModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={e => { if (e.target === e.currentTarget) setVisibilityModal(null); }}>
                <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
                  <div className="border-b border-slate-200 px-6 py-4">
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Lock size={18} className="text-slate-500" />
                      Visibilidade — {visibilityModal.name}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Selecione quem pode ver esta seção. Sem seleção = visível para todos.
                    </p>
                  </div>
                  <div className="px-6 pt-3 pb-2 border-b border-slate-100">
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Perfil mínimo</label>
                      <select
                        value={visibilityCategoryRole ?? ''}
                        onChange={e => setVisibilityCategoryRole(e.target.value || null)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400"
                      >
                        <option value="">Visível para todos os perfis</option>
                        <option value="Editor">Editor ou superior</option>
                        <option value="Gestor">Gestor ou superior</option>
                        <option value="Administrador">Apenas Administrador</option>
                      </select>
                    </div>
                    <input
                      type="text"
                      placeholder="Buscar colaborador..."
                      value={visibilitySearch}
                      onChange={e => setVisibilitySearch(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400"
                    />
                    {selectedUserIds.length > 0 && (
                      <p className="mt-1.5 text-xs text-blue-600 font-medium">{selectedUserIds.length} selecionado(s)</p>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto px-6 py-3 space-y-1">
                    {visibilityUsers.length === 0 ? (
                      <p className="text-slate-400 text-sm py-4 text-center">Carregando colaboradores...</p>
                    ) : visibilityUsers
                      .filter(u => !visibilitySearch || u.name.toLowerCase().includes(visibilitySearch.toLowerCase()))
                      .map(u => (
                      <label key={u.id} className="flex items-center gap-3 cursor-pointer py-1.5 px-2 rounded-lg hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={selectedUserIds.includes(u.id)}
                          onChange={e => setSelectedUserIds(cur => e.target.checked ? [...cur, u.id] : cur.filter(id => id !== u.id))}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600"
                        />
                        {u.photo_url ? (
                          <img src={u.photo_url} className="h-8 w-8 rounded-full object-cover flex-shrink-0" alt={u.name} />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500 flex-shrink-0">
                            {u.name[0]}
                          </div>
                        )}
                        <span className="text-sm text-slate-700">{u.name}</span>
                      </label>
                    ))}
                  </div>
                  <div className="border-t border-slate-200 px-6 py-4 flex justify-between items-center">
                    <button
                      onClick={() => setSelectedUserIds([])}
                      className="text-sm text-slate-500 hover:text-slate-700 font-medium"
                    >
                      Limpar (todos podem ver)
                    </button>
                    <div className="flex gap-2">
                      <button onClick={() => { setVisibilityModal(null); setVisibilitySearch(''); }} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 font-medium">
                        Cancelar
                      </button>
                      <button
                        onClick={saveVisibility}
                        disabled={visibilityLoading}
                        className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        {visibilityLoading ? 'Salvando...' : 'Salvar'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

      {articleVisibilityOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={e => { if (e.target === e.currentTarget) setArticleVisibilityOpen(false); }}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Lock size={18} className="text-slate-500" />
                Acesso ao Artigo
              </h3>
              <p className="mt-1 text-sm text-slate-500">Selecione usuários com acesso exclusivo. Sem seleção = acesso livre (por perfil).</p>
            </div>
            <div className="px-6 pt-3 pb-2 border-b border-slate-100">
              <input
                type="text"
                placeholder="Buscar colaborador..."
                value={visibilitySearch}
                onChange={e => setVisibilitySearch(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400"
              />
              {articleAllowedUserIds.length > 0 && (
                <p className="mt-1.5 text-xs text-blue-600 font-medium">{articleAllowedUserIds.length} selecionado(s)</p>
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-3 space-y-1">
              {visibilityUsers.length === 0 ? (
                <p className="text-slate-400 text-sm py-4 text-center">Carregando colaboradores...</p>
              ) : visibilityUsers
                .filter(u => !visibilitySearch || u.name.toLowerCase().includes(visibilitySearch.toLowerCase()))
                .map(u => (
                <label key={u.id} className="flex items-center gap-3 cursor-pointer py-1.5 px-2 rounded-lg hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={articleAllowedUserIds.includes(u.id)}
                    onChange={e => setArticleAllowedUserIds(cur => e.target.checked ? [...cur, u.id] : cur.filter(id => id !== u.id))}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600"
                  />
                  {u.photo_url ? (
                    <img src={u.photo_url} className="h-8 w-8 rounded-full object-cover flex-shrink-0" alt={u.name} />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500 flex-shrink-0">
                      {u.name[0]}
                    </div>
                  )}
                  <span className="text-sm text-slate-700">{u.name}</span>
                </label>
              ))}
            </div>
            <div className="border-t border-slate-200 px-6 py-4 flex justify-between items-center">
              <button onClick={() => setArticleAllowedUserIds([])} className="text-sm text-slate-500 hover:text-slate-700 font-medium">
                Limpar (acesso livre)
              </button>
              <div className="flex gap-2">
                <button onClick={() => { setArticleVisibilityOpen(false); setVisibilitySearch(''); }} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 font-medium">
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WikiHeader({
  search,
  setSearch,
  onNew,
  sidebarOpen,
  setSidebarOpen,
}: {
  search: string;
  setSearch: (value: string) => void;
  onNew: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (value: boolean) => void;
}) {
  return (
    <header className="wiki-topbar">
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="wiki-icon-button inline-flex flex-shrink-0"
          title={sidebarOpen ? 'Ocultar navegação' : 'Mostrar navegação'}
        >
          {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
        </button>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0057b8] text-white shadow-sm">
          <BookMarked size={21} />
        </div>
        <div className="hidden min-w-0 sm:block">
          <h1 className="text-lg font-bold leading-tight text-slate-900">WIKI NEX</h1>
          <p className="hidden text-xs leading-tight text-slate-500 sm:block">Centro de conhecimento operacional</p>
        </div>
      </div>

      <div className="wiki-global-search">
        <Search size={18} className="flex-shrink-0 text-slate-400" />
        <input
          type="text"
          placeholder="Pesquisar título, conteúdo, tags ou categoria..."
          value={search}
          onChange={event => setSearch(event.target.value)}
          className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
        />
        {search && (
          <button onClick={() => setSearch('')} className="text-xs font-semibold text-slate-400 hover:text-slate-700">
            Limpar
          </button>
        )}
      </div>

      <button onClick={onNew} className="wiki-primary-button">
        <Plus size={16} />
        <span className="hidden sm:inline">Novo Artigo</span>
      </button>
    </header>
  );
}

function WikiSidebar({
  categories,
  loading,
  selectedCat,
  editingCategoryId,
  categoryDraft,
  categorySaving,
  newCategoryParentId,
  setSelectedCat,
  setCategoryDraft,
  onAddCategory,
  onAddSubcategory,
  onEditCategory,
  onDeleteCategory,
  onSaveCategory,
  onCancelCategory,
  isAdmin,
  onSetVisibility,
}: {
  categories: CategoryWithArticles[];
  loading: boolean;
  selectedCat: string | null;
  editingCategoryId: string | null;
  categoryDraft: CategoryDraft;
  categorySaving: boolean;
  newCategoryParentId: string | null;
  setSelectedCat: (value: string | null) => void;
  setCategoryDraft: (value: CategoryDraft) => void;
  onAddCategory: () => void;
  onAddSubcategory: (parentId: string) => void;
  onEditCategory: (category: CategoryWithArticles) => void;
  onDeleteCategory: (category: CategoryWithArticles) => void;
  onSaveCategory: () => void;
  onCancelCategory: () => void;
  isAdmin: boolean;
  onSetVisibility: (category: CategoryWithArticles) => void;
}) {
  const topLevel = categories.filter(c => !c.parent_id);
  const childrenByParent: Record<string, CategoryWithArticles[]> = {};
  categories.filter(c => !!c.parent_id).forEach(c => {
    if (!childrenByParent[c.parent_id!]) childrenByParent[c.parent_id!] = [];
    childrenByParent[c.parent_id!].push(c);
  });

  const [expandedParents, setExpandedParents] = useState<Set<string>>(
    () => new Set(topLevel.map(c => c.id))
  );

  function toggleParent(id: string) {
    setExpandedParents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const renderCategoryRow = (category: CategoryWithArticles, isChild = false) => {
    const Icon = ICON_MAP[(category.icon || 'folder').toLowerCase()] || Folder;
    const activeCategory = selectedCat === category.name;
    const children = childrenByParent[category.id] || [];
    const hasChildren = children.length > 0;
    const isExpanded = expandedParents.has(category.id);

    return (
      <div key={category.id} className="mb-0.5">
        <div className={cn('group flex items-center gap-0.5', isChild ? 'pl-5 pr-3' : 'px-3')}>
          {/* Expand/collapse toggle (top-level with children) */}
          {!isChild && (
            <button
              type="button"
              onClick={() => toggleParent(category.id)}
              className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded hover:bg-slate-200 text-slate-400"
              title={hasChildren ? (isExpanded ? 'Recolher' : 'Expandir') : undefined}
              tabIndex={hasChildren ? 0 : -1}
              style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
            >
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          )}

          <button
            onClick={() => setSelectedCat(activeCategory ? null : category.name)}
            className={cn('wiki-sidebar-section', activeCategory && 'wiki-sidebar-section-active')}
            style={{ paddingLeft: isChild ? '2px' : undefined }}
          >
            {isChild
              ? <ChevronRight size={11} style={{ color: category.color || '#0057b8', flexShrink: 0, opacity: 0.7 }} />
              : <Icon size={14} style={{ color: category.color || '#0057b8' }} />}
            <span className="truncate">{category.name}</span>
            <span className="ml-auto text-[10px] text-slate-400">{category._articles.length}</span>
          </button>

          {/* Add subfolder */}
          <button
            type="button"
            onClick={() => onAddSubcategory(category.id)}
            className="wiki-sidebar-row-action"
            title={`Adicionar subpasta em ${category.name}`}
          >
            <Plus size={12} />
          </button>

          {/* Edit */}
          <button
            type="button"
            onClick={() => onEditCategory(category)}
            className="wiki-sidebar-row-action"
            title={`Editar ${category.name}`}
          >
            <Edit3 size={12} />
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => onSetVisibility(category)}
              className="wiki-sidebar-row-action"
              title="Visibilidade"
            >
              {category.allowed_user_ids?.length ? <Lock size={12} className="text-amber-500" /> : <LockOpen size={12} />}
            </button>
          )}
        </div>

        {/* Inline form for editing this category */}
        {editingCategoryId === category.id && (
          <div className={cn('pb-2', isChild ? 'pl-9 pr-4' : 'pl-11 pr-4')}>
            <CategoryInlineForm
              draft={categoryDraft}
              saving={categorySaving}
              setDraft={setCategoryDraft}
              onCancel={onCancelCategory}
              onSave={onSaveCategory}
              onDelete={() => onDeleteCategory(category)}
            />
          </div>
        )}

        {/* Inline form for new subcategory under this parent */}
        {editingCategoryId === 'new' && newCategoryParentId === category.id && (
          <div className="pl-9 pr-4 pb-2">
            <CategoryInlineForm
              draft={categoryDraft}
              saving={categorySaving}
              setDraft={setCategoryDraft}
              onCancel={onCancelCategory}
              onSave={onSaveCategory}
            />
          </div>
        )}

        {/* Children (rendered when expanded) */}
        {!isChild && isExpanded && children.map(child => renderCategoryRow(child, true))}
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col border-r border-slate-200 bg-slate-50">
      <div className="border-b border-slate-200 px-4 py-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedCat(null)}
            className={cn('wiki-sidebar-root', !selectedCat && 'wiki-sidebar-root-active')}
          >
            <BookOpen size={16} />
            Todos os artigos
          </button>
          <button
            onClick={onAddCategory}
            className="wiki-sidebar-add"
            title="Adicionar setor"
            type="button"
          >
            <Plus size={15} />
          </button>
        </div>

        {/* New top-level category form */}
        {editingCategoryId === 'new' && newCategoryParentId === null && (
          <CategoryInlineForm
            draft={categoryDraft}
            saving={categorySaving}
            setDraft={setCategoryDraft}
            onCancel={onCancelCategory}
            onSave={onSaveCategory}
          />
        )}
      </div>

      <nav className="scrollbar-thin flex-1 overflow-y-auto py-3">
        {loading ? (
          Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="px-4 py-2">
              <div className="h-8 animate-pulse rounded-md bg-slate-200/70" />
            </div>
          ))
        ) : (
          topLevel.map(category => renderCategoryRow(category, false))
        )}
      </nav>
    </div>
  );
}

function CategoryInlineForm({
  draft,
  saving,
  setDraft,
  onCancel,
  onSave,
  onDelete,
}: {
  draft: CategoryDraft;
  saving: boolean;
  setDraft: (value: CategoryDraft) => void;
  onCancel: () => void;
  onSave: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="wiki-category-form">
      <input
        value={draft.name}
        onChange={event => setDraft({ ...draft, name: event.target.value })}
        placeholder="Nome do setor"
      />
      <textarea
        value={draft.description}
        onChange={event => setDraft({ ...draft, description: event.target.value })}
        placeholder="Descrição curta"
        rows={2}
      />
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={draft.color}
          onChange={event => setDraft({ ...draft, color: event.target.value })}
          className="wiki-category-color"
          title="Cor do setor"
        />
        <div className="flex-1">
          <div className="grid grid-cols-8 gap-0.5 p-1.5 border border-slate-200 rounded max-h-24 overflow-y-auto bg-white">
            {(Object.entries(ICON_MAP) as [string, React.ComponentType<{ size?: number }>][]).map(([name, IconComp]) => (
              <button
                key={name}
                type="button"
                onClick={() => setDraft({ ...draft, icon: name })}
                className={cn(
                  'p-1 rounded flex items-center justify-center transition-colors',
                  draft.icon === name ? 'bg-blue-500 text-white' : 'hover:bg-slate-100 text-slate-500'
                )}
                title={name}
              >
                <IconComp size={13} />
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onSave} disabled={!draft.name.trim() || saving} className="wiki-category-save">
          <Save size={13} />
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
        <button type="button" onClick={onCancel} className="wiki-category-cancel">
          Cancelar
        </button>
        {onDelete && (
          <button type="button" onClick={onDelete} className="wiki-category-delete" title="Remover setor">
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

function WikiHome({
  categories,
  allArticles,
  loading,
  selectedCat,
  setSelectedCat,
  recentlyUpdated,
  onOpen,
  onEdit,
  onNew,
}: {
  categories: CategoryWithArticles[];
  allArticles: WikiArticle[];
  loading: boolean;
  selectedCat: string | null;
  setSelectedCat: (value: string | null) => void;
  recentlyUpdated: WikiArticle[];
  onOpen: (article: WikiArticle) => void;
  onEdit: (article: WikiArticle) => void;
  onNew: () => void;
}) {
  return (
    <div className="wiki-home">
      {/* ── Hero compact ── */}
      <section className="wiki-hero-compact">
        <div className="flex-1 min-w-0 relative z-10">
          <p className="wiki-eyebrow">Rede Nex · Wiki</p>
          <h2 className="mt-1 text-3xl font-bold text-slate-950 md:text-4xl">Base de processos e conhecimento</h2>
          <p className="mt-2 text-base text-slate-500">Documentação viva da equipe — procedimentos, padrões e guias passo a passo.</p>
        </div>
        <div className="relative z-10 flex items-center gap-4 flex-shrink-0">
          <div className="text-center px-5 py-3 rounded-xl bg-slate-50 border border-slate-200">
            <p className="text-4xl font-bold text-[#0057b8]">{allArticles.length}</p>
            <p className="text-sm text-slate-500 font-medium">Artigos</p>
          </div>
          <div className="text-center px-5 py-3 rounded-xl bg-slate-50 border border-slate-200">
            <p className="text-4xl font-bold text-orange-500">{categories.length}</p>
            <p className="text-sm text-slate-500 font-medium">Áreas</p>
          </div>
          <button onClick={onNew} className="wiki-primary-button text-base py-3 px-5">
            <Plus size={18} />
            Novo artigo
          </button>
        </div>
      </section>

      {/* ── Category pill filter strip ── */}
      <section className="wiki-category-strip">
        <button
          onClick={() => setSelectedCat(null)}
          className={cn('wiki-category-pill', !selectedCat && 'wiki-category-pill-active')}
        >
          <BookOpen size={18} />
          Todas
        </button>
        {categories.filter(c => !c.parent_id).map(category => {
          const Icon = ICON_MAP[(category.icon || 'folder').toLowerCase()] || Folder;
          const active = selectedCat === category.name;
          return (
            <button
              key={category.id}
              onClick={() => setSelectedCat(active ? null : category.name)}
              className={cn('wiki-category-pill', active && 'wiki-category-pill-active')}
            >
              <Icon size={18} />
              {category.name}
              <span>{category._articles.length}</span>
            </button>
          );
        })}
      </section>

      {/* ── No filter selected: cards grid + aside ── */}
      {!selectedCat && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section>
            {loading ? (
              <div className="wiki-panel p-6 text-sm text-slate-500">Carregando categorias...</div>
            ) : categories.length > 0 ? (
              <>
                <p className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-400">Áreas de conhecimento</p>
                <div className="wiki-category-grid">
                  {categories.filter(c => !c.parent_id).map(category => {
                    const Icon = ICON_MAP[(category.icon || 'folder').toLowerCase()] || Folder;
                    const color = category.color || '#0057b8';
                    return (
                      <div
                        key={category.id}
                        className="wiki-category-card"
                        style={{ borderColor: `${color}30` }}
                        onClick={() => setSelectedCat(category.name)}
                      >
                        <div
                          className="wiki-category-card-header"
                          style={{ background: `linear-gradient(135deg, ${color}cc, ${color}88)` }}
                        >
                          <div className="wiki-category-card-icon">
                            <Icon size={42} className="text-white drop-shadow-sm" />
                          </div>
                        </div>
                        <div className="wiki-category-card-body">
                          <h4>{category.name}</h4>
                          <p>{category.description || 'Processos e procedimentos da área'}</p>
                          <div className="wiki-category-card-count">
                            <span style={{ color, backgroundColor: `${color}12` }}>{category._articles.length} artigo{category._articles.length !== 1 ? 's' : ''}</span>
                            <span className="text-xs font-semibold hover:underline" style={{ color }}>
                              Ver tudo →
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="wiki-empty-state">
                <BookOpen size={44} />
                <h3>Comece a Wiki</h3>
                <p>Crie o primeiro artigo de documentação da equipe.</p>
                <button onClick={onNew} className="wiki-primary-button">
                  <Plus size={16} />
                  Criar artigo
                </button>
              </div>
            )}
          </section>

          <aside className="space-y-4">
            <div className="wiki-panel p-5">
              <div className="wiki-aside-title">
                <History size={16} />
                Atualizações recentes
              </div>
              <div className="space-y-1">
                {recentlyUpdated.length ? recentlyUpdated.map(article => (
                  <button key={article.id} onClick={() => onOpen(article)} className="wiki-recent-item">
                    <span>{article.title}</span>
                    <small>{timeAgo(article.updated_at)}</small>
                  </button>
                )) : (
                  <p className="text-sm text-slate-400">Nenhum artigo publicado.</p>
                )}
              </div>
            </div>
            <div className="wiki-panel p-5">
              <div className="wiki-aside-title">
                <CheckCircle2 size={16} />
                Como usar a Wiki
              </div>
              <div className="space-y-3">
                {[
                  { step: '1', text: 'Escolha uma área acima' },
                  { step: '2', text: 'Abra o artigo desejado' },
                  { step: '3', text: 'Siga os passos ou edite o conteúdo' },
                ].map(item => (
                  <div key={item.step} className="flex items-start gap-3">
                    <span className="wiki-step-badge flex-shrink-0">{item.step}</span>
                    <p className="text-sm text-slate-600 leading-5 pt-1">{item.text}</p>
                  </div>
                ))}
                <button onClick={onNew} className="wiki-primary-button mt-2 w-full justify-center">
                  <Plus size={14} />
                  Novo artigo
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ── Category filter selected: article list ── */}
      {selectedCat && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
          <section className="space-y-6">
            {loading ? (
              <div className="wiki-panel p-6 text-sm text-slate-500">Carregando artigos...</div>
            ) : (
              categories.filter(c => c.name === selectedCat).map(category => {
                if (category._articles.length === 0) return (
                  <div key={category.id} className="wiki-panel p-8 text-center text-slate-400 text-sm">
                    Nenhum artigo nesta categoria ainda.
                    <button onClick={onNew} className="wiki-primary-button mx-auto mt-3">
                      <Plus size={14} />
                      Criar primeiro artigo
                    </button>
                  </div>
                );
                const Icon = ICON_MAP[(category.icon || 'folder').toLowerCase()] || Folder;
                return (
                  <div key={category.id} className="wiki-panel">
                    <div className="wiki-section-head">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="wiki-section-icon" style={{ backgroundColor: `${category.color || '#0057b8'}18` }}>
                          <Icon size={18} style={{ color: category.color || '#0057b8' }} />
                        </div>
                        <div className="min-w-0">
                          <h3>{category.name}</h3>
                          <p>{category.description || `${category._articles.length} artigos disponíveis`}</p>
                        </div>
                      </div>
                      <button onClick={onNew} className="wiki-muted-button">
                        <Plus size={14} />
                        Adicionar
                      </button>
                    </div>
                    <div className="flex flex-col gap-1 p-3">
                      {category._articles.map(article => (
                        <ArticleRow
                          key={article.id}
                          article={article}
                          onOpen={() => onOpen(article)}
                          onEdit={() => onEdit(article)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </section>

          <aside className="space-y-4">
            <div className="wiki-panel p-5">
              <div className="wiki-aside-title">
                <History size={16} />
                Atualizações recentes
              </div>
              <div className="space-y-1">
                {recentlyUpdated.length ? recentlyUpdated.map(article => (
                  <button key={article.id} onClick={() => onOpen(article)} className="wiki-recent-item">
                    <span>{article.title}</span>
                    <small>{timeAgo(article.updated_at)}</small>
                  </button>
                )) : (
                  <p className="text-sm text-slate-400">Nenhum artigo publicado.</p>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function SearchResults({
  query,
  results,
  onOpen,
  onEdit,
  onNew,
}: {
  query: string;
  results: WikiArticle[];
  onOpen: (article: WikiArticle) => void;
  onEdit: (article: WikiArticle) => void;
  onNew: () => void;
}) {
  return (
    <div className="wiki-home">
      <div className="wiki-page-title">
        <p className="wiki-eyebrow">Busca</p>
        <h2>{results.length} resultado(s) para "{query}"</h2>
      </div>

      {results.length ? (
        <div className="wiki-panel flex flex-col gap-1 p-3">
          {results.map(article => (
            <ArticleRow key={article.id} article={article} onOpen={() => onOpen(article)} onEdit={() => onEdit(article)} />
          ))}
        </div>
      ) : (
        <div className="wiki-empty-state">
          <Search size={44} />
          <h3>Nada encontrado</h3>
          <p>Crie um artigo novo para documentar este assunto.</p>
          <button onClick={onNew} className="wiki-primary-button">
            <Plus size={16} />
            Criar artigo
          </button>
        </div>
      )}
    </div>
  );
}

function formatArticleDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}


function PdfViewer({ url }: { url: string }) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNum, setPageNum] = useState(1);
  const [pgWidth, setPgWidth] = useState(320);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function measure() {
      if (containerRef.current) {
        setPgWidth(Math.min(containerRef.current.clientWidth - 32, 900));
      }
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 relative overflow-hidden">
        <div ref={containerRef} className="h-full overflow-auto flex justify-center bg-slate-800 p-4">
          <Document
            file={url}
            onLoadSuccess={({ numPages: n }) => { setNumPages(n); setPageNum(1); }}
            loading={<p className="text-white text-sm mt-8 text-center">Carregando PDF…</p>}
            error={<p className="text-red-400 text-sm mt-8 text-center">Não foi possível carregar o PDF.</p>}
          >
            {pgWidth > 0 && <Page pageNumber={pageNum} width={pgWidth} renderTextLayer={false} renderAnnotationLayer={false} />}
          </Document>
        </div>
        <button onClick={() => setPageNum(p => Math.max(1, p - 1))} disabled={pageNum <= 1} className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-slate-900/70 hover:bg-slate-900/90 text-white disabled:opacity-20 active:scale-95 transition-all text-2xl flex items-center justify-center z-10 shadow-lg">‹</button>
        <span className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-slate-900/70 text-white text-xs px-3 py-1 rounded-full z-10">{numPages > 0 ? pageNum + ' / ' + numPages : '...'}</span>
        <button onClick={() => setPageNum(p => Math.min(numPages || 1, p + 1))} disabled={pageNum >= (numPages || 1)} className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-slate-900/70 hover:bg-slate-900/90 text-white disabled:opacity-20 active:scale-95 transition-all text-2xl flex items-center justify-center z-10 shadow-lg">›</button>
      </div>
    </div>
  );
}

type FileViewerState = { url: string; name: string };

function FileViewerModal({ url, name, onClose }: FileViewerState & { onClose: () => void }) {
  const [txtContent, setTxtContent] = useState<string | null>(null);
  const [txtLoading, setTxtLoading] = useState(false);

  const ext = (url.split('?')[0].split('.').pop() || '').toLowerCase();
  const isGDrive = url.includes('drive.google.com') || url.includes('docs.google.com');
  const isPdf = !isGDrive && ext === 'pdf';
  const isTxt = !isGDrive && ['txt', 'md', 'csv'].includes(ext);
  const isImage = !isGDrive && ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext);

  function toEmbed(u: string) {
    const fileMatch = u.match(/\/file\/d\/([^/?]+)/);
    if (fileMatch) return `https://drive.google.com/file/d/${fileMatch[1]}/preview`;
    const docsMatch = u.match(/(https:\/\/docs\.google\.com\/[^/]+\/d\/[^/?]+)/);
    if (docsMatch) return `${docsMatch[1]}/preview`;
    return u;
  }

  useEffect(() => {
    if (!isTxt) return;
    setTxtLoading(true);
    fetch(url, { credentials: 'include' })
      .then(r => r.text())
      .then(t => setTxtContent(t))
      .catch(() => setTxtContent('Erro ao carregar arquivo.'))
      .finally(() => setTxtLoading(false));
  }, [url, isTxt]);

    const embedUrl = isGDrive ? toEmbed(url) : url;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="flex items-center gap-3 px-4 py-2 bg-slate-900 text-white border-b border-slate-700 shrink-0">
        <span className="flex-1 font-semibold truncate text-sm">📄 {name}</span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          title="Abrir em nova aba"
        >
          <ExternalLink size={16} />
        </a>
        <button
          onClick={onClose}
          className="p-1.5 rounded hover:bg-red-600 text-slate-300 hover:text-white transition-colors"
          title="Fechar"
        >
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {isImage ? (
          <div className="flex h-full items-center justify-center p-6">
            <img src={url} alt={name} className="max-w-full max-h-full object-contain rounded shadow-xl" />
          </div>
        ) : isTxt ? (
          txtLoading ? (
            <div className="flex h-full items-center justify-center text-slate-300 text-sm">Carregando...</div>
          ) : (
            <pre className="h-full overflow-auto bg-slate-950 text-slate-100 text-sm p-6 font-mono whitespace-pre-wrap break-words leading-relaxed">
              {txtContent}
            </pre>
          )
        ) : isPdf ? (
          <PdfViewer url={url} />
        ) : (
          <iframe
            src={embedUrl}
            className="w-full h-full border-0 bg-white"
            title={name}
            allow="fullscreen"
          />
        )}
      </div>
    </div>
  );
}

function ArticleView({
  article,
  toc,
  onBack,
  onEdit,
  onLike,
  onDelete,
}: {
  article: WikiArticle;
  toc: TocItem[];
  onBack: () => void;
  onEdit: () => void;
  onLike: () => void;
  onDelete?: () => void;
}) {
  const CategoryIcon = article.categories?.name ? ICON_MAP[(article.categories.icon || 'folder').toLowerCase()] || BookOpen : BookOpen;
  const articleBody = removeLeadingTitle(article.content || '');
  const [fileViewer, setFileViewer] = useState<FileViewerState | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [versions, setVersions] = useState<import('../lib/wikiApi').WikiVersion[]>([]);
  const [versionsExpanded, setVersionsExpanded] = useState(false);
  const [comments, setComments] = useState<WikiComment[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [likers, setLikers] = useState<WikiUserEntry[]>([]);
  const [viewers, setViewers] = useState<WikiUserEntry[]>([]);

  const loadVersions = useCallback(async () => {
    try {
      const v = await listWikiVersions(article.id);
      setVersions(v);
    } catch {
      /* silently ignore */
    }
  }, [article.id]);

  const loadComments = useCallback(async () => {
    try {
      const data = await getWikiComments(article.id);
      setComments((data as WikiComment[]) || []);
    } catch {
      /* silently ignore */
    }
  }, [article.id]);

  const loadLikersViewers = useCallback(async () => {
    try {
      const [l, v] = await Promise.all([getWikiLikers(article.id), getWikiViewers(article.id)]);
      setLikers(l as WikiUserEntry[]);
      setViewers(v as WikiUserEntry[]);
    } catch {
      /* silently ignore */
    }
  }, [article.id]);

  async function submitComment() {
    const text = commentInput.trim();
    if (!text || commentLoading) return;
    setCommentLoading(true);
    try {
      await createWikiComment(article.id, text);
      setCommentInput('');
      await loadComments();
    } catch {
      /* silently ignore */
    } finally {
      setCommentLoading(false);
    }
  }

  useEffect(() => { loadVersions(); }, [loadVersions]);
  useEffect(() => { loadComments(); }, [loadComments]);
  useEffect(() => { loadLikersViewers(); }, [loadLikersViewers]);

  const latestEditor = versions.length > 0 ? versions[0] : null;
  const wasEdited = latestEditor && latestEditor.editor?.id !== article.author_id;

  return (
    <div className="wiki-document-layout">
      <article className="wiki-document">
        <div className="wiki-breadcrumb">
          <button onClick={onBack}>
            <ArrowLeft size={14} />
            Wiki
          </button>
          <ChevronRight size={13} />
          <span>{article.categories?.name || 'Sem categoria'}</span>
          <button
            onClick={() => navigator.clipboard.writeText(window.location.origin + '/wiki?artigo=' + article.id).catch(() => {})}
            className="ml-auto inline-flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 transition-colors"
            title="Copiar link direto para este artigo"
          >
            <Link size={12} />
            Copiar link
          </button>
        </div>

{article.format !== 'html' && (<>
        <header className="wiki-document-header">
          <div className="mb-4 flex items-center gap-2">
            <span className="wiki-document-category" style={{ color: article.categories?.color || '#0057b8', backgroundColor: `${article.categories?.color || '#0057b8'}14` }}>
              <CategoryIcon size={14} />
              {article.categories?.name || 'Geral'}
            </span>
            <span className="wiki-status-badge">
              <Globe size={12} />
              Publicado
            </span>
            {article.role_required && (
              <span className="wiki-status-badge" style={{ background: '#fff3e0', color: '#e65100', border: '1px solid #ffcc80' }}>
                <Eye size={12} />
                {article.role_required}+
              </span>
            )}
          </div>
          <h2>{article.title}</h2>
          <div className="wiki-document-meta">
            {article.users && (
              <span className="flex items-center gap-2">
                <img
                  src={article.users.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(article.users.name)}&size=24&background=0057b8&color=fff`}
                  alt={article.users.name}
                />
                Publicado por <strong>{article.users.name}</strong> em {formatArticleDate(article.created_at)}
              </span>
            )}
            {wasEdited && latestEditor?.editor && (
              <span className="flex items-center gap-2">
                <img
                  src={latestEditor.editor.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(latestEditor.editor.name)}&size=24&background=e07b00&color=fff`}
                  alt={latestEditor.editor.name}
                />
                Editado por <strong>{latestEditor.editor.name}</strong> em {formatArticleDate(article.updated_at)}
              </span>
            )}
            <span>{article.view_count ?? 0} visualizações</span>
            <span>{article.like_count ?? 0} validações</span>
            <span>{article.comment_count ?? 0} comentários</span>
          </div>
        </header>
        </>)}

        <div
          className={'wiki-content' + (article.format === 'html' ? ' wiki-content--html' : '')}
          onClick={e => {
            const a = (e.target as HTMLElement).closest('a');
            if (!a) return;
            const href = a.getAttribute('href') || '';
            if (!href) return;
            const ext = (href.split('?')[0].split('.').pop() || '').toLowerCase();
            const isGDrive = href.includes('drive.google.com') || href.includes('docs.google.com');
            const viewableExts = new Set(['pdf', 'txt', 'md', 'csv', 'png', 'jpg', 'jpeg', 'gif', 'webp']);
            if (!href.startsWith('/uploads/') && !isGDrive && !viewableExts.has(ext)) return;
            e.preventDefault();
            const rawName = a.textContent?.trim().replace(/^📎\s*/, '') || href.split('/').pop() || 'arquivo';
            setFileViewer({ url: href, name: rawName });
          }}
          dangerouslySetInnerHTML={{ __html:
            (article.format === 'html' || article.format === 'visual')
              ? sanitizeWikiHtml(articleBody)
              : article.format === 'asciidoc'
                ? renderAsciiDoc(articleBody)
                : renderMarkdown(articleBody)
          }}
        />

        {!article.content && (
          <div className="wiki-empty-state my-8">
            <FileText size={40} />
            <h3>Artigo sem conteúdo</h3>
            <p>Adicione instruções, passos ou referências para a equipe.</p>
            <button onClick={onEdit} className="wiki-primary-button">
              <Edit3 size={16} />
              Editar artigo
            </button>
          </div>
        )}
      </article>

      <aside className="wiki-right-rail">
        <div className="wiki-panel p-4">
          <button onClick={onEdit} className="wiki-primary-button mb-3 w-full justify-center">
            <Edit3 size={15} />
            Editar página
          </button>
          {onDelete && (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="w-full flex items-center justify-center gap-2 text-sm font-semibold py-2 px-3 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition-colors mb-3"
            >
              <Trash2 size={15} />
              Apagar artigo
            </button>
          )}
          {deleteConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={e => { if (e.target === e.currentTarget) setDeleteConfirm(false); }}>
              <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                    <Trash2 size={20} className="text-red-600" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Apagar artigo?</h3>
                </div>
                <p className="text-sm text-slate-600 mb-5">Esta ação é <strong>irreversível</strong>. O artigo <em>"{article.title}"</em> e todo seu histórico serão permanentemente excluídos.</p>
                <div className="flex gap-3">
                  <button onClick={() => setDeleteConfirm(false)} className="flex-1 py-2 px-4 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors">Cancelar</button>
                  <button onClick={() => { setDeleteConfirm(false); onDelete?.(); }} className="flex-1 py-2 px-4 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-colors flex items-center justify-center gap-2">
                    <Trash2 size={15} />
                    Apagar
                  </button>
                </div>
              </div>
            </div>
          )}
          <button onClick={onLike} className="wiki-secondary-action">
            <Star size={15} />
            Validar ({article.like_count ?? 0})
          </button>
        </div>

        {/* Version history */}
        {versions.length > 0 && (
          <div className="wiki-panel p-4">
            <button
              className="wiki-aside-title w-full text-left"
              onClick={() => setVersionsExpanded(e => !e)}
            >
              <History size={16} />
              Histórico de versões
              <span className="ml-auto text-xs text-slate-400 font-normal">{versions.length}</span>
            </button>
            {versionsExpanded && (
              <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                {versions.map((v, idx) => (
                  <div key={v.id} className="flex items-start gap-2 text-xs text-slate-600 py-1 border-b border-slate-50 last:border-0">
                    <div className={cn(
                      'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5',
                      idx === 0 ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'
                    )}>
                      {v.version_number}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{v.editor?.name ?? 'Desconhecido'}</p>
                      <p className="text-slate-400">{formatArticleDate(v.created_at)}</p>
                    </div>
                    {idx === 0 && <span className="ml-auto text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-semibold flex-shrink-0">atual</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="wiki-panel p-4">
          <div className="wiki-aside-title">
            <ListTree size={16} />
            Nesta página
          </div>
          {toc.length ? (
            <nav className="space-y-1">
              {toc.map(item => (
                <a key={item.id} href={`#${item.id}`} className={cn('wiki-toc-link', item.level === 3 && 'pl-5')}>
                  {item.text}
                </a>
              ))}
            </nav>
          ) : (
            <p className="text-xs text-slate-400">Sem subtítulos neste artigo.</p>
          )}
        </div>

        {/* Quem visualizou */}
        <div className="wiki-panel p-4">
          <div className="wiki-aside-title mb-2">
            <Eye size={16} />
            Visualizações
            <span className="ml-auto text-xs text-slate-400 font-normal">{article.view_count ?? 0}</span>
          </div>
          {viewers.length === 0 ? (
            <p className="text-xs text-slate-400">Nenhum visualizador registrado.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
              {viewers.map(v => (
                <div key={v.user_id} title={v.users?.name} className="relative group">
                  <img
                    src={v.users?.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(v.users?.name || '?')}&size=28&background=0057b8&color=fff`}
                    alt={v.users?.name}
                    className="h-7 w-7 rounded-full object-cover border-2 border-white ring-1 ring-slate-200"
                  />
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 whitespace-nowrap rounded bg-slate-800 px-2 py-0.5 text-[10px] text-white opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                    {v.users?.name || 'Usuário'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quem curtiu */}
        <div className="wiki-panel p-4">
          <div className="wiki-aside-title mb-2">
            <Heart size={16} />
            Validações
            <span className="ml-auto text-xs text-slate-400 font-normal">{article.like_count ?? 0}</span>
          </div>
          {likers.length === 0 ? (
            <p className="text-xs text-slate-400">Nenhuma curtida ainda.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
              {likers.map(l => (
                <div key={l.user_id} title={l.users?.name} className="relative group">
                  <img
                    src={l.users?.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(l.users?.name || '?')}&size=28&background=ff7a00&color=fff`}
                    alt={l.users?.name}
                    className="h-7 w-7 rounded-full object-cover border-2 border-white ring-1 ring-orange-200"
                  />
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 whitespace-nowrap rounded bg-slate-800 px-2 py-0.5 text-[10px] text-white opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                    {l.users?.name || 'Usuário'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tags */}
        <div className="wiki-panel p-4">
          <div className="wiki-aside-title">
            <Tag size={16} />
            Tags
          </div>
          <div className="flex flex-wrap gap-2">
            {(article.tags || ['documentação']).map(tag => (
              <span key={tag} className="wiki-tag">{tag}</span>
            ))}
          </div>
        </div>

        {/* Comments */}
        <div className="wiki-panel p-4">
          <div className="wiki-aside-title mb-3">
            <MessageSquare size={16} />
            Comentários e Sugestões
            {comments.length > 0 && (
              <span className="ml-auto text-xs text-slate-400 font-normal">{comments.length}</span>
            )}
          </div>

          {/* Input */}
          <div className="flex gap-2 mb-3">
            <textarea
              value={commentInput}
              onChange={e => setCommentInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment(); } }}
              placeholder="Adicionar comentário ou sugestão..."
              rows={2}
              className="wiki-comment-input"
            />
            <button
              onClick={submitComment}
              disabled={!commentInput.trim() || commentLoading}
              className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-lg bg-[#0057b8] text-white transition-all hover:bg-[#00499b] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed self-end"
            >
              <Send size={13} />
            </button>
          </div>

          {/* List */}
          {comments.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-2">Seja o primeiro a comentar.</p>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-0">
              {comments.map(c => (
                <div key={c.id} className="wiki-comment-item">
                  <img
                    src={c.users?.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.users?.name || '?')}&size=28&background=0057b8&color=fff`}
                    alt={c.users?.name}
                    className="wiki-comment-avatar"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-700 truncate">{c.users?.name || 'Usuário'}</p>
                    <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{c.content}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{formatArticleDate(c.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
      {fileViewer && <FileViewerModal {...fileViewer} onClose={() => setFileViewer(null)} />}
    </div>
  );
}

function EditorChoiceView({
  onBack,
  onSelect,
}: {
  onBack: () => void;
  onSelect: (choice: EditorChoice) => void;
}) {
  const choices: Array<{
    id: EditorChoice;
    title: string;
    description: string;
    icon: typeof Code2;
  }> = [
    {
      id: 'visual',
      title: 'Editor visual',
      description: 'Editor rico tipo Word, com página branca e barra de formatação completa.',
      icon: Eye,
    },
    {
      id: 'markdown',
      title: 'Markdown',
      description: 'Editor dividido com código Markdown à esquerda e prévia à direita.',
      icon: Code2,
    },
    {
      id: 'html',
      title: 'HTML / Código',
      description: 'Editor de código escuro para HTML bruto e importações da Wiki.js.',
      icon: FileText,
    },
    {
      id: 'asciidoc',
      title: 'AsciiDoc',
      description: 'Editor dividido com sintaxe AsciiDoc e prévia renderizada.',
      icon: BookOpen,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="wiki-muted-button">
          <ArrowLeft size={15} />
          Voltar
        </button>
        <div>
          <p className="wiki-eyebrow">Nova página</p>
          <h2 className="text-2xl font-bold text-slate-950">Escolha como deseja adicionar o conteúdo</h2>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {choices.map(choice => (
          <button
            key={choice.id}
            onClick={() => onSelect(choice.id)}
            className="group rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-[#0057b8] transition-colors group-hover:bg-[#0057b8] group-hover:text-white">
              <choice.icon size={20} />
            </div>
            <h3 className="text-base font-bold text-slate-950">{choice.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">{choice.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function EditorView({
  mode,
  editorChoice,
  categories,
  editContent,
  editTitle,
  newArticleTitle,
  newArticleCat,
  setEditContent,
  setEditTitle,
  setNewArticleTitle,
  setNewArticleCat,
  onSave,
  onUploadMedia,
  onChangeEditorChoice,
  onBack,
  articleRoleRequired,
  setArticleRoleRequired,
  articleAllowedUserIds,
  onOpenArticleVisibility,
}: {
  mode: 'edit' | 'new';
  editorChoice: EditorChoice;
  article: WikiArticle | null;
  categories: CategoryWithArticles[];
  editContent: string;
  editTitle: string;
  editTab: EditorTab;
  newArticleTitle: string;
  newArticleCat: string;
  setEditContent: (value: string) => void;
  setEditTitle: (value: string) => void;
  setEditTab: (value: EditorTab) => void;
  setNewArticleTitle: (value: string) => void;
  setNewArticleCat: (value: string) => void;
  onSave: () => Promise<void>;
  onUploadMedia: (file: File) => Promise<{ public_url: string; file_name: string; file_type?: string }>;
  onChangeEditorChoice: (choice: EditorChoice) => void;
  onBack: () => void;
  articleRoleRequired?: string | null;
  setArticleRoleRequired?: (v: string | null) => void;
  articleAllowedUserIds?: string[];
  onOpenArticleVisibility?: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedImg, setSelectedImg] = useState<HTMLImageElement | null>(null);
  const [editorFileViewer, setEditorFileViewer] = useState<FileViewerState | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const visualEditorRef = useRef<HTMLDivElement>(null);
  const title = mode === 'new' ? newArticleTitle : editTitle;

  function handlePreviewLinkClick(e: React.MouseEvent<HTMLDivElement>) {
    const a = (e.target as HTMLElement).closest('a');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (!href) return;
    const ext = (href.split('?')[0].split('.').pop() || '').toLowerCase();
    const isGDrive = href.includes('drive.google.com') || href.includes('docs.google.com');
    const viewableExts = new Set(['pdf', 'txt', 'md', 'csv', 'png', 'jpg', 'jpeg', 'gif', 'webp']);
    if (!href.startsWith('/uploads/') && !isGDrive && !viewableExts.has(ext)) return;
    e.preventDefault();
    const rawName = a.textContent?.trim().replace(/^📎\s*/, '') || href.split('/').pop() || 'arquivo';
    setEditorFileViewer({ url: href, name: rawName });
  }

  function syncEditorContent() {
    const el = visualEditorRef.current;
    if (el) setEditContent(el.innerHTML);
  }

  function insertHtmlAtCursor(html: string) {
    visualEditorRef.current?.focus();
    document.execCommand('insertHTML', false, html);
    syncEditorContent();
  }

  function insertColumns(count: number) {
    const cols = Array(count).fill('<div class="wiki-col"><p>Coluna</p></div>').join('');
    insertHtmlAtCursor(`<div class="wiki-columns wiki-cols-${count}">${cols}</div><p><br></p>`);
  }

  function handleEditorClick(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    setSelectedImg(target.tagName === 'IMG' ? (target as HTMLImageElement) : null);
    if (target.classList.contains('wiki-file-view') || (target.parentElement?.classList.contains('wiki-file-view'))) {
      event.preventDefault();
      const card = target.closest('[data-file-url]') as HTMLElement | null;
      if (card) setEditorFileViewer({ url: card.dataset.fileUrl || '', name: card.dataset.fileName || 'arquivo' });
    }
  }

  function setImageStyle(updates: Partial<CSSStyleDeclaration>) {
    if (!selectedImg) return;
    Object.assign(selectedImg.style, updates);
    syncEditorContent();
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    const file = event.dataTransfer.files?.[0];
    if (file) { event.preventDefault(); handleUpload(file); }
  }

  // Initialize visual editor content only when switching to visual mode.
  // Never set innerHTML again while user is typing — this prevents the cursor-reset bug.
  useEffect(() => {
    if (editorChoice === 'visual' && visualEditorRef.current) {
      visualEditorRef.current.innerHTML = editContent || '<p>Type the page content here</p>';
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorChoice]);
  const editorLabel = {
    visual: 'Visual Editor',
    markdown: 'Markdown',
    html: 'Code',
    asciidoc: 'AsciiDoc',
  }[editorChoice];
  const editorPlaceholder = editorChoice === 'html'
    ? `<h1>Title</h1>

<p>Some text here</p>`
    : editorChoice === 'asciidoc'
      ? `== header

content`
      : `# Header

Your content here`;
  const currentTitle = title.trim() || 'Untitled Page';

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(file?: File) {
    if (!file || uploading) return;
    setUploading(true);
    try {
      const media = await onUploadMedia(file);
      const isVideo = media.file_type?.startsWith('video/');
      const isImage = media.file_type?.startsWith('image/');

      if (editorChoice === 'visual') {
        let html: string;
        if (isImage) {
          html = `<img src="${media.public_url}" alt="${media.file_name}" style="max-width:100%" />`;
        } else if (isVideo) {
          html = `<video src="${media.public_url}" controls style="max-width:100%"></video>`;
        } else {
          html = `<div class="wiki-file-card" contenteditable="false" data-file-url="${media.public_url}" data-file-name="${media.file_name}"><span>📎</span><span class="wiki-file-card-name">${media.file_name}</span><button class="wiki-file-view" type="button">👁 Visualizar</button></div>`;
        }
        insertHtmlAtCursor(html);
      } else {
        let snippet: string;
        if (!isVideo && !isImage) {
          snippet = editorChoice === 'html'
            ? `\n<a href="${media.public_url}" target="_blank" rel="noopener noreferrer">📎 ${media.file_name}</a>\n`
            : editorChoice === 'asciidoc'
              ? `\nlink:${media.public_url}[📎 ${media.file_name}]\n`
              : `\n[📎 ${media.file_name}](${media.public_url})\n`;
        } else if (isVideo) {
          snippet = editorChoice === 'html'
            ? `\n<video src="${media.public_url}" controls></video>\n`
            : editorChoice === 'asciidoc'
              ? `\n\nvideo::${media.public_url}[]\n`
              : `\n\n[video:${media.public_url}]\n`;
        } else {
          snippet = editorChoice === 'html'
            ? `\n<img src="${media.public_url}" alt="${media.file_name}" />\n`
            : editorChoice === 'asciidoc'
              ? `\n\nimage::${media.public_url}[${media.file_name}]\n`
              : `\n\n![${media.file_name}](${media.public_url})\n`;
        }
        setEditContent(prev => prev + snippet);
        setEditTab('write');
      }
    } finally {
      setUploading(false);
    }
  }

  function insertTextSnippet(snippet: string) {
    setEditContent(`${editContent}${snippet}`);
  }

  function visualCommand(command: string, value?: string) {
    document.execCommand(command, false, value);
    const editable = document.querySelector('[data-wiki-visual-editor="true"]') as HTMLElement | null;
    if (editable) setEditContent(editable.innerHTML);
  }

  return (
    <div className={cn('wiki-mode-editor', `wiki-mode-${editorChoice}`)}>
      <header className="wiki-mode-topbar">
        <div className="wiki-mode-brand">WIKI - NEX TELECOM</div>
        <div className="wiki-mode-title">{currentTitle}</div>
        <div className="wiki-mode-actions">
          <button type="button" onClick={handleSave} disabled={!title.trim() || saving}>
            <CheckCircle2 size={18} />
            {saving ? 'SALVANDO' : mode === 'new' ? 'CRIAR' : 'SALVAR'}
          </button>
          <span><Tag size={18} /> PAGINA</span>
          <button type="button" onClick={onBack}>
            <Trash2 size={18} />
            FECHAR
          </button>
        </div>
      </header>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={event => handleUpload(event.target.files?.[0])}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/webm"
        className="hidden"
        onChange={event => handleUpload(event.target.files?.[0])}
      />
      <input
        ref={attachInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx"
        className="hidden"
        onChange={event => handleUpload(event.target.files?.[0])}
      />

      <div className="wiki-mode-pagebar">
        {mode === 'new' && (
          <select value={newArticleCat} onChange={event => setNewArticleCat(event.target.value)}>
            <option value="">Selecionar categoria...</option>
            {categories.map(category => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        )}
        <input
          type="text"
          placeholder="Titulo do artigo"
          value={title}
          onChange={event => mode === 'new' ? setNewArticleTitle(event.target.value) : setEditTitle(event.target.value)}
        />
        <select
          value={editorChoice}
          onChange={event => {
            const next = event.target.value as EditorChoice;
            if (next === editorChoice) return;
            if (editContent.trim() && !window.confirm('Mudar o formato pode alterar a visualização do conteúdo existente. Continuar?')) return;
            onChangeEditorChoice(next);
          }}
          title="Formato do editor"
          style={{ minWidth: '9rem', flexShrink: 0 }}
        >
          <option value="visual">Editor Visual</option>
          <option value="markdown">Markdown</option>
          <option value="html">HTML</option>
          <option value="asciidoc">AsciiDoc</option>
        </select>
        <select
          value={articleRoleRequired ?? ''}
          onChange={event => setArticleRoleRequired?.(event.target.value || null)}
          title="Visibilidade do artigo"
          style={{ minWidth: '11rem', flexShrink: 0 }}
        >
          <option value="">Visível para todos</option>
          <option value="Editor">Editor ou superior</option>
          <option value="Gestor">Gestor ou superior</option>
          <option value="Administrador">Apenas Administrador</option>
        </select>
        <button
          type="button"
          title="Usuários com acesso exclusivo"
          onClick={onOpenArticleVisibility}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap"
          style={{ flexShrink: 0 }}
        >
          <Users size={14} />
          {articleAllowedUserIds && articleAllowedUserIds.length > 0
            ? `${articleAllowedUserIds.length} usuário(s)`
            : 'Usuários'
          }
        </button>
      </div>

      {editorChoice === 'visual' ? (
        <>
          <div className="wiki-visual-toolbar" onMouseDown={event => event.preventDefault()}>
            {/* Block format */}
            <select onChange={event => visualCommand('formatBlock', event.target.value)} defaultValue="p">
              <option value="p">Parágrafo</option>
              <option value="h1">Título 1</option>
              <option value="h2">Título 2</option>
              <option value="h3">Título 3</option>
              <option value="blockquote">Citação</option>
              <option value="pre">Código</option>
            </select>
            {/* Font size */}
            <select title="Tamanho da fonte" defaultValue="3" onChange={event => visualCommand('fontSize', event.target.value)}>
              <option value="1">10px</option>
              <option value="2">13px</option>
              <option value="3">16px</option>
              <option value="4">18px</option>
              <option value="5">24px</option>
              <option value="6">32px</option>
              <option value="7">48px</option>
            </select>
            {/* Separador */}
            <span className="wiki-tb-sep" />
            <button type="button" title="Negrito" onClick={() => visualCommand('bold')}><Bold size={16} /></button>
            <button type="button" title="Itálico" onClick={() => visualCommand('italic')}><Italic size={16} /></button>
            <button type="button" title="Sublinhado" onClick={() => visualCommand('underline')}><Underline size={16} /></button>
            <button type="button" title="Riscado" onClick={() => visualCommand('strikeThrough')} style={{ fontWeight: 700, textDecoration: 'line-through', fontSize: '14px' }}>S</button>
            <span className="wiki-tb-sep" />
            {/* Text color */}
            <label title="Cor do texto" className="wiki-tb-color">
              <span style={{ fontSize: '10px', fontWeight: 700, lineHeight: 1 }}>A</span>
              <input type="color" defaultValue="#000000" onChange={event => visualCommand('foreColor', event.target.value)} />
            </label>
            {/* Highlight */}
            <label title="Cor de fundo" className="wiki-tb-color">
              <span style={{ fontSize: '10px', fontWeight: 700, lineHeight: 1, background: 'linear-gradient(135deg,#ff0,#fff)', padding: '0 2px', borderRadius: '2px' }}>A</span>
              <input type="color" defaultValue="#ffff00" onChange={event => visualCommand('hiliteColor', event.target.value)} />
            </label>
            <span className="wiki-tb-sep" />
            <button type="button" title="Lista" onClick={() => visualCommand('insertUnorderedList')}><List size={16} /></button>
            <button type="button" title="Lista numerada" onClick={() => visualCommand('insertOrderedList')}><ListOrdered size={16} /></button>
            <span className="wiki-tb-sep" />
            <button type="button" title="Alinhar esquerda" onClick={() => visualCommand('justifyLeft')}><AlignLeft size={16} /></button>
            <button type="button" title="Centralizar" onClick={() => visualCommand('justifyCenter')}><AlignCenter size={16} /></button>
            <button type="button" title="Alinhar direita" onClick={() => visualCommand('justifyRight')}><AlignRight size={16} /></button>
            <button type="button" title="Justificar" onClick={() => visualCommand('justifyFull')}><AlignJustify size={16} /></button>
            <span className="wiki-tb-sep" />
            <button type="button" title="2 colunas" onClick={() => insertColumns(2)} style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '-1px' }}>II</button>
            <button type="button" title="3 colunas" onClick={() => insertColumns(3)} style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '-1px' }}>III</button>
            <span className="wiki-tb-sep" />
            <button type="button" title="Link" onClick={() => visualCommand('createLink', window.prompt('URL do link') || '')}><Link size={16} /></button>
            <button type="button" title="Imagem" onClick={() => imageInputRef.current?.click()}><ImageIcon size={16} /></button>
            <button type="button" title="Video" onClick={() => videoInputRef.current?.click()}><Video size={16} /></button>
            <button type="button" title="Inserir vídeo por link (YouTube, Drive, Vimeo)" onClick={() => {
              const url = window.prompt('Cole o link do vídeo (YouTube, Google Drive, Vimeo):');
              if (!url?.trim()) return;
              const ei = getEmbedInfo(url.trim());
              if (!ei.type) { window.alert('Link não reconhecido. Use YouTube, Google Drive ou Vimeo.'); return; }
              insertHtmlAtCursor(`<div contenteditable="false" style="position:relative;width:100%;padding-bottom:56.25%;margin:1rem 0"><iframe src="${ei.embedUrl}" style="position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:8px" allowfullscreen allow="autoplay; encrypted-media; fullscreen" loading="lazy" title="Vídeo"></iframe></div><p><br></p>`);
            }}><ExternalLink size={16} /></button>
            <button type="button" title="Anexar arquivo (PDF, DOC, XLS)" onClick={() => attachInputRef.current?.click()}><Paperclip size={16} /></button>
            <button type="button" title="Linha horizontal" onClick={() => visualCommand('insertHorizontalRule')}><Minus size={16} /></button>
            <span className="wiki-tb-sep" />
            <button type="button" title="Remover formatação" onClick={() => visualCommand('removeFormat')} style={{ fontSize: '11px', fontWeight: 700 }}>Tx</button>
          </div>

          {/* Image controls — shown when an image is selected */}
          {selectedImg && (
            <div className="wiki-img-controls" onMouseDown={e => e.preventDefault()}>
              <span>Imagem:</span>
              <button type="button" onClick={() => setImageStyle({ float: 'left', display: 'inline', margin: '0 1rem 0.5rem 0', maxWidth: '50%' })}>◀ Esq</button>
              <button type="button" onClick={() => setImageStyle({ float: 'right', display: 'inline', margin: '0 0 0.5rem 1rem', maxWidth: '50%' })}>Dir ▶</button>
              <button type="button" onClick={() => setImageStyle({ float: 'none', display: 'block', margin: '1rem auto', maxWidth: '100%' })}>⊡ Centro</button>
              <span className="wiki-tb-sep" />
              <button type="button" onClick={() => setImageStyle({ width: '100%', maxWidth: '100%' })}>100%</button>
              <button type="button" onClick={() => setImageStyle({ width: '75%', maxWidth: '75%' })}>75%</button>
              <button type="button" onClick={() => setImageStyle({ width: '50%', maxWidth: '50%' })}>50%</button>
              <button type="button" onClick={() => setImageStyle({ width: '25%', maxWidth: '25%' })}>25%</button>
              <span className="wiki-tb-sep" />
              <button type="button" title="Desselecionar" onClick={() => setSelectedImg(null)}>✕</button>
            </div>
          )}

          <div className="wiki-word-stage">
            <div
              ref={visualEditorRef}
              data-wiki-visual-editor="true"
              className="wiki-word-page"
              contentEditable
              suppressContentEditableWarning
              dir="ltr"
              onInput={syncEditorContent}
              onClick={handleEditorClick}
              onDrop={handleDrop}
              onDragOver={event => event.preventDefault()}
            />
          </div>
        </>
      ) : editorChoice === 'html' ? (
        <div className="wiki-code-shell">
          <aside className="wiki-code-rail">
            <Link size={18} />
            <ImageIcon size={20} onClick={() => imageInputRef.current?.click()} />
            <Paperclip size={20} onClick={() => attachInputRef.current?.click()} style={{ cursor: 'pointer' }} />
            <Table size={18} />
            <Code2 size={18} />
          </aside>
          <textarea
            value={editContent}
            onChange={event => setEditContent(event.target.value)}
            placeholder={editorPlaceholder}
            spellCheck={false}
          />
        </div>
      ) : (
        <>
          <div className="wiki-source-toolbar">
            <button type="button" onClick={() => insertTextSnippet(editorChoice === 'asciidoc' ? '*bold*' : '**bold**')}><Bold size={16} /></button>
            <button type="button" onClick={() => insertTextSnippet(editorChoice === 'asciidoc' ? '_italic_' : '*italic*')}><Italic size={16} /></button>
            <button type="button" onClick={() => insertTextSnippet(editorChoice === 'asciidoc' ? '\n== Header\n' : '\n## Header\n')}>H#</button>
            <button type="button" onClick={() => insertTextSnippet(editorChoice === 'asciidoc' ? '\n* item\n' : '\n- item\n')}><List size={16} /></button>
            <button type="button" onClick={() => insertTextSnippet('\n1. item\n')}><ListOrdered size={16} /></button>
            <button type="button" onClick={() => insertTextSnippet(editorChoice === 'asciidoc' ? '\n----\ncode\n----\n' : '\n' + String.fromCharCode(96).repeat(3) + '\ncode\n' + String.fromCharCode(96).repeat(3) + '\n')}><Code2 size={16} /></button>
            <button type="button" onClick={() => imageInputRef.current?.click()}><ImageIcon size={16} /></button>
            <button type="button" onClick={() => videoInputRef.current?.click()}><Video size={16} /></button>
            <button type="button" title="Inserir vídeo por link (YouTube, Drive, Vimeo)" onClick={() => {
              const url = window.prompt('Cole o link do vídeo (YouTube, Google Drive, Vimeo):');
              if (url?.trim()) insertTextSnippet(`\n\n${url.trim()}\n\n`);
            }}><ExternalLink size={16} /></button>
            <button type="button" title="Anexar arquivo (PDF, DOC, XLS)" onClick={() => attachInputRef.current?.click()}><Paperclip size={16} /></button>
            <button type="button" onClick={() => insertTextSnippet(editorChoice === 'asciidoc' ? "\n'''\n" : '\n---\n')}><Minus size={16} /></button>
          </div>
          <div className={cn('wiki-split-editor', editorChoice === 'asciidoc' && 'wiki-split-asciidoc')}>
            <div className="wiki-source-pane">
              <div className="wiki-line-number">1</div>
              <textarea
                value={editContent}
                onChange={event => setEditContent(event.target.value)}
                placeholder={editorPlaceholder}
                spellCheck={false}
              />
            </div>
            <div className="wiki-preview-pane">
              {editContent ? (
                <div className="wiki-content" onClick={handlePreviewLinkClick} dangerouslySetInnerHTML={{ __html: renderEditorPreview(editContent, editorChoice) }} />
              ) : (
                <p className="p-6 text-sm italic text-slate-400">Nenhum conteúdo para visualizar.</p>
              )}
            </div>
          </div>
        </>
      )}

      <footer className="wiki-mode-statusbar">
        <span>PT-BR</span>
        <span>/new-page</span>
        <strong>{editorLabel}</strong>
        <span>{editContent.length} caracteres, {editContent.trim() ? editContent.trim().split(/\s+/).length : 0} palavras</span>
      </footer>
      {editorFileViewer && <FileViewerModal {...editorFileViewer} onClose={() => setEditorFileViewer(null)} />}
    </div>
  );
}

function ArticleRow({
  article,
  onOpen,
  onEdit,
}: {
  article: WikiArticle;
  onOpen: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="wiki-article-row group" onClick={onOpen}>
      <div className="wiki-article-icon" style={{ color: article.categories?.color || '#0057b8', backgroundColor: `${article.categories?.color || '#0057b8'}14` }}>
        <FileText size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <h4>{article.title}</h4>
          {article.categories?.name && <span className="wiki-row-category">{article.categories.name}</span>}
        </div>
        <p>{stripMarkdown(article.content).slice(0, 150) || 'Sem resumo disponível.'}</p>
        <div className="wiki-row-meta">
          {article.users?.name && <span>{article.users.name}</span>}
          <span>Atualizado {timeAgo(article.updated_at)}</span>
          <span>{article.view_count ?? 0} visualizações</span>
          <span>{article.like_count ?? 0} validações</span>
          {article.tags?.slice(0, 2).map(tag => <span key={tag}>#{tag}</span>)}
        </div>
      </div>
      <button
        onClick={event => {
          event.stopPropagation();
          onEdit();
        }}
        className="wiki-row-edit"
        title="Editar artigo"
      >
        <Edit3 size={16} />
      </button>
    </div>
  );
}

