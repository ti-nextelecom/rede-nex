import { query } from './db.js';
import { notifyUsers } from './notifications.repository.js';

const articleSelect = `
  select
    a.id,
    a.title,
    a.slug,
    a.content,
    a.format,
    a.status,
    a.role_required,
    a.allowed_user_ids,
    a.tags,
    a.category_id,
    a.author_id,
    a.created_at,
    a.updated_at,
    json_build_object(
      'id', c.id,
      'name', c.name,
      'color', c.color,
      'description', c.description,
      'icon', c.icon
    ) as categories,
    case
      when u.id is null then null
      else json_build_object(
        'id', u.id,
        'name', u.name,
        'photo_url', u.photo_url,
        'position', u.position
      )
    end as users,
    coalesce((select count(*)::int from wiki_article_views wav where wav.article_id = a.id), 0) as view_count,
    coalesce((select count(*)::int from wiki_article_likes wal where wal.article_id = a.id), 0) as like_count,
    coalesce((select count(*)::int from wiki_article_comments wac where wac.article_id = a.id), 0) as comment_count
  from wiki_articles a
  left join categories c on c.id = a.category_id
  left join users u on u.id = a.author_id
`;

export async function listCategories(userId = null, userRole = null) {
  const { rows } = await query(`
    select
      c.id,
      c.name,
      c.description,
      c.icon,
      c.color,
      c.parent_id,
      c.type,
      c.created_at,
      c.allowed_user_ids,
      c.role_required,
      count(a.id)::int as article_count
    from categories c
    left join wiki_articles a on a.category_id = c.id and a.status <> 'archived'
    where c.type = 'wiki'
      and (
        c.allowed_user_ids is null
        or $1::uuid = any(c.allowed_user_ids)
        or $2 = 'Administrador'
      )
    group by c.id
    order by c.name
  `, [userId, userRole]);
  return rows;
}

export async function setCategoryVisibility(id, allowedUserIds, roleRequired) {
  const { rows } = await query(
    `update categories set allowed_user_ids = $2, role_required = $3 where id = $1 and type = 'wiki' returning id, name, allowed_user_ids, role_required`,
    [id, allowedUserIds?.length ? allowedUserIds : null, roleRequired ?? null]
  );
  return rows[0] ?? null;
}

export async function createCategory(input) {
  const { rows } = await query(
    `
      insert into categories (name, description, icon, color, type, parent_id)
      values ($1, $2, $3, $4, 'wiki', $5)
      returning *
    `,
    [input.name, input.description ?? null, input.icon ?? null, input.color ?? '#0057b8', input.parent_id ?? null]
  );
  return rows[0];
}

export async function updateCategory(id, input) {
  const { rows } = await query(
    `
      update categories
      set name = $2, description = $3, icon = $4, color = $5, parent_id = $6
      where id = $1 and type = 'wiki'
      returning *
    `,
    [id, input.name, input.description ?? null, input.icon ?? null, input.color ?? '#0057b8', input.parent_id ?? null]
  );
  return rows[0] ?? null;
}

export async function deleteCategory(id) {
  const { rowCount } = await query('delete from categories where id = $1 and type = $2', [id, 'wiki']);
  return rowCount > 0;
}

export async function listArticles(filters) {
  const page = Math.max(Number(filters.page ?? 1), 1);
  const pageSize = Math.min(Math.max(Number(filters.pageSize ?? 50), 1), 1000);
  const offset = (page - 1) * pageSize;
  const params = [
    filters.status ?? 'published',
    filters.categoryId || null,
    filters.search || null,
    filters.userRole || null,
    filters.userId || null,
    pageSize,
    offset,
  ];
  const where = `
    where ($1::text is null or a.status = $1)
      and ($2::uuid is null or a.category_id = $2)
      and (
        $3::text is null
        or a.title ilike '%' || $3 || '%'
        or a.content ilike '%' || $3 || '%'
        or exists (
          select 1 from unnest(coalesce(a.tags, array[]::text[])) tag
          where tag ilike '%' || $3 || '%'
        )
      )
      and (
        a.role_required is null
        or $4 = 'Administrador'
        or ($4 = 'Gestor' and a.role_required in ('Editor', 'Gestor'))
        or ($4 = 'Editor' and a.role_required = 'Editor')
      )
      and (
        a.allowed_user_ids is null
        or $5::uuid is null
        or $5::uuid = any(a.allowed_user_ids)
        or $4 = 'Administrador'
      )
  `;

  const [{ rows }, countResult] = await Promise.all([
    query(`${articleSelect} ${where} order by a.updated_at desc limit $6 offset $7`, params),
    query(`select count(*)::int as total from wiki_articles a ${where}`, params.slice(0, 5)),
  ]);

  return {
    data: rows,
    meta: {
      page,
      pageSize,
      total: countResult.rows[0]?.total ?? 0,
    },
  };
}

export function searchArticles(term) {
  return listArticles({ search: term, status: 'published', page: 1, pageSize: 20 });
}

export async function getArticleById(id) {
  const { rows } = await query(`${articleSelect} where a.id = $1 limit 1`, [id]);
  return rows[0] ?? null;
}

export async function getArticleBySlug(slug) {
  const { rows } = await query(`${articleSelect} where a.slug = $1 limit 1`, [slug]);
  return rows[0] ?? null;
}

export async function recordArticleView(articleId, userId = null) {
  if (userId) {
    await query(
      `
        insert into wiki_article_views (article_id, user_id, viewed_at)
        values ($1, $2, now())
        on conflict (article_id, user_id) do update set viewed_at = now()
      `,
      [articleId, userId]
    );
  } else {
    await query('insert into wiki_article_views (article_id) values ($1)', [articleId]);
  }
  return getArticleById(articleId);
}

export async function toggleArticleLike(articleId, userId) {
  const { rows } = await query(
    `
      with removed as (
        delete from wiki_article_likes
        where article_id = $1 and user_id = $2
        returning id
      ),
      inserted as (
        insert into wiki_article_likes (article_id, user_id)
        select $1, $2
        where not exists (select 1 from removed)
        returning id
      )
      select exists(select 1 from inserted) as liked
    `,
    [articleId, userId]
  );
  return { liked: rows[0]?.liked ?? false, article: await getArticleById(articleId) };
}

export async function listArticleComments(articleId) {
  const { rows } = await query(
    `
      select
        c.id,
        c.article_id,
        c.author_id,
        c.content,
        c.created_at,
        c.updated_at,
        case
          when u.id is null then null
          else json_build_object('id', u.id, 'name', u.name, 'photo_url', u.photo_url, 'position', u.position)
        end as users
      from wiki_article_comments c
      left join users u on u.id = c.author_id
      where c.article_id = $1
      order by c.created_at
    `,
    [articleId]
  );
  return rows;
}

export async function createArticleComment(articleId, userId, content) {
  const { rows } = await query(
    `
      insert into wiki_article_comments (article_id, author_id, content)
      values ($1, $2, $3)
      returning id
    `,
    [articleId, userId, content]
  );
  return (await listArticleComments(articleId)).find(comment => comment.id === rows[0].id);
}

export async function createArticle(input) {
  const { rows } = await query(
    `
      with inserted as (
        insert into wiki_articles (title, slug, content, format, category_id, author_id, status, tags)
        values ($1, $2, $3, coalesce($8, 'markdown'), $4, $5, coalesce($6, 'draft'), $7)
        returning *
      ),
      version as (
        insert into wiki_versions (article_id, content, editor_id, version_number)
        select id, content, author_id, 1 from inserted
      )
      select * from inserted
    `,
    [
      input.title,
      input.slug,
      input.content ?? '',
      input.category_id ?? null,
      input.author_id ?? null,
      input.status ?? 'draft',
      input.tags ?? [],
      input.format ?? null,
    ]
  );
  const article = await getArticleById(rows[0].id);
  const wikiActor = input.author_id ? await query('select name, photo_url from users where id = $1 limit 1', [input.author_id]) : { rows: [] };
  await notifyUsers({
    actorId: input.author_id ?? null,
    actorName: wikiActor.rows[0]?.name || null,
    actorPhotoUrl: wikiActor.rows[0]?.photo_url || null,
    type: 'wiki',
    title: 'Novo artigo na Wiki',
    message: article?.title,
    link: `/wiki?artigo=${article?.id}`,
  });
  return article;
}

export async function updateArticle(id, input) {
  const { rows } = await query(
    `
      with next_version as (
        select coalesce(max(version_number), 0) + 1 as value
        from wiki_versions
        where article_id = $1
      ),
      updated as (
        update wiki_articles
        set
          title = coalesce($2, title),
          slug = coalesce($3, slug),
          content = coalesce($4, content),
          format = coalesce($9, format),
          category_id = coalesce($5::uuid, category_id),
          status = coalesce($6, status),
          tags = coalesce($7::text[], tags),
          updated_at = now()
        where id = $1
        returning *
      ),
      version as (
        insert into wiki_versions (article_id, content, editor_id, version_number)
        select updated.id, updated.content, $8, next_version.value
        from updated, next_version
      )
      select * from updated
    `,
    [
      id,
      input.title ?? null,
      input.slug ?? null,
      input.content ?? null,
      input.category_id ?? null,
      input.status ?? null,
      input.tags ?? null,
      input.editor_id ?? input.author_id ?? null,
      input.format ?? null,
    ]
  );
  if (!rows[0]) return null;
  const article = await getArticleById(rows[0].id);
  const editorId = input.editor_id ?? input.author_id ?? null;
  const wikiEditor = editorId ? await query('select name, photo_url from users where id = $1 limit 1', [editorId]) : { rows: [] };
  await notifyUsers({
    actorId: editorId,
    actorName: wikiEditor.rows[0]?.name || null,
    actorPhotoUrl: wikiEditor.rows[0]?.photo_url || null,
    type: 'wiki',
    title: 'Wiki atualizada',
    message: article?.title,
    link: `/wiki?artigo=${article?.id}`,
  });
  return article;
}

export function updateArticleStatus(id, status, editorId) {
  return updateArticle(id, { status, editor_id: editorId });
}

export async function archiveArticle(id) {
  const { rowCount } = await query(
    `update wiki_articles set status = 'archived', updated_at = now() where id = $1`,
    [id]
  );
  return rowCount > 0;
}

export async function listVersions(articleId) {
  const { rows } = await query(
    `
      select
        v.id,
        v.article_id,
        v.version_number,
        v.created_at,
        case
          when u.id is null then null
          else json_build_object('id', u.id, 'name', u.name, 'photo_url', u.photo_url)
        end as editor
      from wiki_versions v
      left join users u on u.id = v.editor_id
      where v.article_id = $1
      order by v.version_number desc
    `,
    [articleId]
  );
  return rows;
}

export async function restoreVersion(articleId, versionId, editorId) {
  const { rows } = await query('select content from wiki_versions where id = $1 and article_id = $2', [versionId, articleId]);
  if (!rows[0]) return null;
  return updateArticle(articleId, { content: rows[0].content, editor_id: editorId });
}

export async function listArticleLikes(articleId) {
  const { rows } = await query(
    `
      select
        l.user_id,
        l.created_at,
        json_build_object('id', u.id, 'name', u.name, 'photo_url', u.photo_url) as users
      from wiki_article_likes l
      left join users u on u.id = l.user_id
      where l.article_id = $1
      order by l.created_at desc
    `,
    [articleId]
  );
  return rows;
}

export async function listArticleViews(articleId) {
  const { rows } = await query(
    `
      select
        v.user_id,
        v.viewed_at as created_at,
        json_build_object('id', u.id, 'name', u.name, 'photo_url', u.photo_url) as users
      from wiki_article_views v
      left join users u on u.id = v.user_id
      where v.article_id = $1 and v.user_id is not null
      order by v.viewed_at desc
    `,
    [articleId]
  );
  return rows;
}

export async function setArticleRoleRequired(id, roleRequired) {
  const { rows } = await query(
    'update wiki_articles set role_required = $2, updated_at = now() where id = $1 returning id, role_required',
    [id, roleRequired ?? null]
  );
  return rows[0] ?? null;
}

export async function setArticleVisibility(id, roleRequired, allowedUserIds) {
  const { rows } = await query(
    'update wiki_articles set role_required = $2, allowed_user_ids = $3, updated_at = now() where id = $1 returning id, role_required, allowed_user_ids',
    [id, roleRequired ?? null, allowedUserIds?.length ? allowedUserIds : null]
  );
  return rows[0] ?? null;
}

export async function deleteArticle(id) {
  const { rowCount } = await query('delete from wiki_articles where id = $1', [id]);
  return rowCount > 0;
}
