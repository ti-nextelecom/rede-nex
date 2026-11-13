import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';

test('Conexao RH preserves spaces and paragraphs when creating, editing and commenting',
  { skip: process.env.RUN_JRH_DB_TESTS !== '1', timeout: 60000 }, async () => {
    const admin = new pg.Pool({ host: '127.0.0.1', port: 55482, user: 'rh_test', database: 'postgres', connectionTimeoutMillis: 3000 });
    const database = 'jrh_text_test_' + process.pid + '_' + Date.now();
    const envFile = resolve('.cache', database + '.env');
    let pool;
    try {
      await admin.query('CREATE DATABASE ' + database + ' OWNER rh_app');
      await mkdir(resolve('.cache'), { recursive: true });
      await writeFile(envFile, '# Fictional localhost JRH text regression only\n');
      process.env.REDE_NEX_ENV_FILE = envFile;
      process.env.DATABASE_URL = 'postgresql://rh_app@127.0.0.1:55482/' + database;
      for (const key of ['PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD']) delete process.env[key];
      ({ pool } = await import('../server/src/db.js'));
      const repo = await import('../server/src/jrh.repository.js');
      await pool.query(`CREATE TABLE roles(id uuid PRIMARY KEY,name text);
        CREATE TABLE departments(id uuid PRIMARY KEY,name text);
        CREATE TABLE users(id uuid PRIMARY KEY,name text,email text,photo_url text,department_id uuid,role_id uuid);
        CREATE TABLE posts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),author_id uuid,title text,content text,type text,category text,
          image_url text,video_url text,pinned boolean DEFAULT false,visibility text,community_id uuid,period_start date,expires_at timestamptz,
          created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
        CREATE TABLE comments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),post_id uuid,author_id uuid,content text,created_at timestamptz DEFAULT now());
        CREATE TABLE post_reactions(id uuid PRIMARY KEY,post_id uuid,user_id uuid,reaction text,created_at timestamptz);
        CREATE TABLE post_views(post_id uuid,user_id uuid,viewed_at timestamptz,UNIQUE(post_id,user_id));`);
      const role = randomUUID(), person = randomUUID();
      await pool.query("INSERT INTO roles VALUES($1,'Administrador')", [role]);
      await pool.query("INSERT INTO users(id,name,email,role_id) VALUES($1,'Pessoa ficticia','rh@example.invalid',$2)", [person, role]);
      const original = 'Bom dia, equipe!\n\n  Primeiro ponto com  dois espaços.\nSegundo ponto.';
      const post = await repo.createJRHPost(person, { title: 'Comunicado da equipe', content: original });
      assert.equal(post.title, 'Comunicado da equipe');
      assert.equal(post.content, original);
      const edited = 'Texto revisado\n\nOutra linha com  espaçamento.\n\nÚltimo parágrafo.';
      const saved = await repo.updateJRHPost(post.id, person, { title: 'Comunicado revisado', content: edited });
      assert.equal(saved.title, 'Comunicado revisado');
      assert.equal(saved.content, edited);
      const comment = 'Obrigada, equipe!\n\nPodemos conversar amanhã?';
      assert.equal((await repo.createJRHComment(post.id, person, comment)).content, comment);
      assert.equal((await repo.listJRHPosts())[0].content, edited);
      assert.equal((await repo.getJRHPost(post.id)).comments[0].content, comment);
      await assert.rejects(repo.createJRHComment(post.id, person, '   \n\n  '), error => error.status === 400);
      const safe = await repo.updateJRHPost(post.id, person, { content: 'Texto\0 com espaços\n\nE parágrafos' });
      assert.equal(safe.content, 'Texto com espaços\n\nE parágrafos');
    } finally {
      await pool?.end();
      await admin.query('DROP DATABASE IF EXISTS ' + database);
      await admin.end();
      await rm(envFile, { force: true });
    }
  });
