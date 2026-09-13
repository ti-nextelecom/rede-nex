import '../src/env.js';
import { pool, query } from '../src/db.js';

async function main() {
  const before = await Promise.all([
    query('select count(*)::int as count from posts'),
    query('select count(*)::int as count from trainings'),
    query('select count(*)::int as count from wiki_articles'),
  ]);

  await query('delete from comments');
  await query('delete from post_reactions');
  await query('delete from post_bookmarks');
  await query('delete from posts');
  await query('delete from training_progress');
  await query('delete from trainings');
  await query('delete from wiki_article_comments');
  await query('delete from wiki_article_likes');
  await query('delete from wiki_article_views');
  await query('delete from wiki_versions');
  await query('delete from wiki_articles');

  const after = await Promise.all([
    query('select count(*)::int as count from posts'),
    query('select count(*)::int as count from trainings'),
    query('select count(*)::int as count from wiki_articles'),
  ]);

  console.log(JSON.stringify({
    before: {
      posts: before[0].rows[0].count,
      trainings: before[1].rows[0].count,
      wiki_articles: before[2].rows[0].count,
    },
    after: {
      posts: after[0].rows[0].count,
      trainings: after[1].rows[0].count,
      wiki_articles: after[2].rows[0].count,
    },
  }, null, 2));
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
