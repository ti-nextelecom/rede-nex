import type { Category, Post, Training, User, WikiArticle } from '../types';

type DepartmentSeed = {
  id: string;
  name: string;
  description?: string;
  created_at: string;
};

type RoleSeed = {
  id: string;
  name: string;
  description?: string;
  created_at: string;
};

const now = new Date().toISOString();

const departments: DepartmentSeed[] = [
  { id: 'dept-suporte', name: 'Suporte Técnico', description: 'Suporte técnico aos clientes', created_at: now },
  { id: 'dept-noc', name: 'NOC', description: 'Centro de Operacoes de Rede', created_at: now },
  { id: 'dept-comercial', name: 'Comercial', description: 'Equipe comercial e vendas', created_at: now },
  { id: 'dept-financeiro', name: 'Financeiro', description: 'Gestao financeira', created_at: now },
  { id: 'dept-csc', name: 'CSC', description: 'Central de Servicos ao Cliente', created_at: now },
  { id: 'dept-infra', name: 'Infraestrutura', description: 'Infraestrutura de rede', created_at: now },
  { id: 'dept-rh', name: 'Recursos Humanos', description: 'Gestao de pessoas', created_at: now },
];

const roles: RoleSeed[] = [
  { id: 'role-admin', name: 'Administrador', description: 'Controle total do sistema', created_at: now },
  { id: 'role-gestor', name: 'Gestor', description: 'Gerenciamento do setor e publicações', created_at: now },
  { id: 'role-editor', name: 'Editor', description: 'Pode criar e editar conteúdos', created_at: now },
  { id: 'role-colab', name: 'Colaborador', description: 'Somente visualização e interação', created_at: now },
];

const users: User[] = [];

const categories: Category[] = [
  { id: 'cat-training-suporte', name: 'Suporte Técnico', description: 'Treinamentos de suporte técnico', icon: 'Wrench', color: '#ff7a00', type: 'training', created_at: now },
  { id: 'cat-training-noc', name: 'NOC', description: 'Treinamentos do Centro de Operações', icon: 'Network', color: '#0057b8', type: 'training', created_at: now },
  { id: 'cat-training-comercial', name: 'Comercial', description: 'Treinamentos da equipe comercial', icon: 'TrendingUp', color: '#16a34a', type: 'training', created_at: now },
  { id: 'cat-training-financeiro', name: 'Financeiro', description: 'Treinamentos financeiros', icon: 'DollarSign', color: '#9333ea', type: 'training', created_at: now },
  { id: 'cat-training-csc', name: 'CSC', description: 'Treinamentos do CSC', icon: 'Headphones', color: '#db2777', type: 'training', created_at: now },
  { id: 'cat-training-infra', name: 'Infraestrutura', description: 'Treinamentos de infraestrutura', icon: 'Server', color: '#ca8a04', type: 'training', created_at: now },
  { id: 'cat-training-rh', name: 'Recursos Humanos', description: 'Treinamentos de RH', icon: 'Users', color: '#0891b2', type: 'training', created_at: now },
  { id: 'cat-wiki-atendimento', name: 'Atendimento', description: 'Processos de atendimento ao cliente', icon: 'HeadphonesIcon', color: '#ff7a00', type: 'wiki', created_at: now },
  { id: 'cat-wiki-suporte', name: 'Suporte Técnico', description: 'Documentação técnica', icon: 'Wrench', color: '#0057b8', type: 'wiki', created_at: now },
  { id: 'cat-wiki-noc', name: 'NOC', description: 'Processos do NOC', icon: 'Network', color: '#16a34a', type: 'wiki', created_at: now },
  { id: 'cat-wiki-financeiro', name: 'Financeiro', description: 'Processos financeiros', icon: 'DollarSign', color: '#9333ea', type: 'wiki', created_at: now },
  { id: 'cat-wiki-comercial', name: 'Comercial', description: 'Processos comerciais', icon: 'TrendingUp', color: '#db2777', type: 'wiki', created_at: now },
  { id: 'cat-wiki-rh', name: 'RH', description: 'Processos de RH', icon: 'Users', color: '#ca8a04', type: 'wiki', created_at: now },
];

let posts: Post[] = [];

const trainings: Training[] = [];

const wikiArticles: WikiArticle[] = [];

function wait() {
  return new Promise(resolve => window.setTimeout(resolve, 180));
}

function withUserRelations<T extends { author_id?: string; created_by?: string; category_id?: string }>(record: T) {
  const userId = record.author_id || record.created_by;
  const user = users.find(item => item.id === userId);
  const category = categories.find(item => item.id === record.category_id);

  return {
    ...record,
    users: user ? { ...user, departments: departments.find(item => item.id === user.department_id), roles: roles.find(item => item.id === user.role_id) } : undefined,
    categories: category,
  };
}

function withPostRelations(post: Post): Post {
  const author = users.find(item => item.id === post.author_id);
  return {
    ...post,
    users: author ? { ...author, departments: departments.find(item => item.id === author.department_id), roles: roles.find(item => item.id === author.role_id) } : undefined,
    likes: [],
    comments: [],
  };
}

export const localDatabase = {
  async getDashboardData() {
    await wait();
    return {
      stats: {
        users: users.length,
        trainings: trainings.filter(item => item.status === 'published').length,
        articles: wikiArticles.filter(item => item.status === 'published').length,
        posts: posts.length,
      },
      recentPosts: posts
        .slice()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)
        .map(withPostRelations),
    };
  },

  async getFeedPosts() {
    await wait();
    return posts
      .slice()
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map(withPostRelations);
  },

  async createPost(content: string, type: Post['type']) {
    await wait();
    const post: Post = {
      id: `post-${Date.now()}`,
      author_id: 'user-pedro',
      content,
      type,
      pinned: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    posts = [post, ...posts];
    return withPostRelations(post);
  },

  async getUsers() {
    await wait();
    return users
      .map(user => ({
        ...user,
        departments: departments.find(item => item.id === user.department_id) ?? null,
        roles: roles.find(item => item.id === user.role_id) ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async getDepartments() {
    await wait();
    return departments.slice().sort((a, b) => a.name.localeCompare(b.name));
  },

  async getTrainingData() {
    await wait();
    return {
      trainings: trainings
        .filter(item => item.status === 'published')
        .map(item => withUserRelations(item) as Training)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
      categories: categories
        .filter(item => item.type === 'training')
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  },

  async getWikiData() {
    await wait();
    return {
      categories: categories
        .filter(item => item.type === 'wiki')
        .sort((a, b) => a.name.localeCompare(b.name)),
      articles: wikiArticles
        .filter(item => item.status === 'published')
        .map(item => withUserRelations(item) as WikiArticle)
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    };
  },
};
