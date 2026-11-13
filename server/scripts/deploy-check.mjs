import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { runtimePool, identity, requireSafeRole } from './deploy-common.mjs';
import { mediaUploadsDir, jrhUploadsDir, pcUploadsDir, downloadsDir } from '../src/runtimePaths.js';

// This is an upgrade contract, NOT a schema generator for a fresh database.
export const coreTables = `users roles departments user_sessions password_reset_tokens audit_logs
  media_assets posts comments post_reactions comment_reactions poll_votes categories trainings
  notifications chat_conversations chat_participants chat_messages tasks task_assignees task_checklists task_checklist_items task_comments task_files task_templates task_custom_lists
  projects project_steps step_assignees step_history project_comments project_attachments project_requests
  calendar_events calendar_event_participants drive_files drive_folders forms form_responses
  sign_documents sign_requests whiteboards whiteboard_participants
  wiki_articles wiki_categories wiki_versions wiki_article_comments wiki_article_likes wiki_article_views
  pc_admins pc_permissoes pc_setores pc_periodos pc_lancamentos pc_comentarios pc_comentarios_periodo pc_anexos
  stories story_views communities community_members user_xp xp_events badges user_badges missions user_missions`.split(/\s+/);
const coreColumns = {
  users: ['id', 'name', 'email', 'password_hash', 'role_id', 'status', 'photo_url', 'position', 'admission_date', 'department_id', 'birth_date'],
  roles: ['id', 'name'], departments: ['id', 'name', 'manager_id', 'parent_id'],
  projects: ['id', 'name', 'responsible_name', 'status', 'progress', 'deadline'],
  notifications: ['user_id', 'title', 'message', 'link', 'actor_name', 'actor_photo_url'],
  tasks: ['id', 'title', 'description', 'status', 'priority', 'protocol', 'created_by', 'owner_id', 'deadline', 'custom_list_id', 'created_at', 'updated_at'],
  task_files: ['id', 'task_id', 'name', 'file_url', 'file_type', 'file_size', 'uploaded_by', 'created_at'],
  chat_conversations: ['id', 'type', 'name', 'pinned_message_id', 'broadcast_mode'],
  chat_participants: ['conversation_id', 'user_id', 'role', 'is_muted', 'is_pinned', 'last_read_at'],
};
const runtimeTables = ['ti_projects', 'ti_tasks', 'ti_task_history', 'training_progress', 'nav_settings', 'task_observers','chat_conversation_archives','task_template_recipients','task_checklist_item_people','chat_attention_requests','browser_push_subscriptions','browser_push_deliveries','chat_message_reactions','password_vaults','device_fcm_tokens','android_push_deliveries','user_avatar_frames','user_appearance_preferences','architecture_projects','behavioral_assessments','behavioral_drafts','behavioral_badges','work_schedule_entries','work_schedule_operations','work_schedule_history'];
export async function checkDatabase(client, { beforeMigrations = false } = {}) {
  const app = await identity(client); requireSafeRole(app);
  const tables = [...coreTables, ...(beforeMigrations ? [] : runtimeTables)];
  const present = (await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`)).rows.map(row => row.table_name);
  const missing = tables.filter(name => !present.includes(name));
  if (missing.length) throw new Error('Banco existente incompatível; tabelas ausentes/inacessíveis: ' + missing.join(', '));
  for (const [table, columns] of Object.entries(coreColumns)) {
    const actual = (await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1", [table])).rows.map(row => row.column_name);
    const absent = columns.filter(column => !actual.includes(column));
    if (absent.length) throw new Error(`Colunas ausentes em ${table}: ${absent.join(', ')}. Revisar o schema da VM; não restaurar um dump`);
  }
  for (const table of tables) {
    const result = (await client.query("SELECT has_table_privilege(current_user,$1,'SELECT') ok", ['public.' + table])).rows[0];
    if (!result.ok) throw new Error('Sem SELECT em public.' + table);
  }
  if (!beforeMigrations) {
    const deliveryColumn=(await client.query("SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='chat_messages' AND column_name='client_message_id'")).rowCount;
    if (!deliveryColumn) throw new Error('Aplique a migração de confirmação de envio do chat');
    const templateColumns=(await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='task_templates'")).rows;
    if(!templateColumns.some(column=>column.column_name==='task_snapshot')) throw new Error('Aplique a migração de modelos completos de tarefas');
    const employeeColumns = (await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='nex_hr' AND table_name='employees'")).rows;
    if (!employeeColumns.some(column => column.column_name === 'termination_on')) throw new Error('Aplique a migração da data de demissão do RH antes de iniciar a API');
    const fileColumns = (await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='task_files'")).rows;
    if (!fileColumns.some(column => column.column_name === 'checklist_item_id')) throw new Error('Aplique a migração de colaboração de tarefas antes de iniciar a API');
    const hr = (await client.query(`SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,
      (has_table_privilege(current_user,c.oid,'SELECT') AND has_table_privilege(current_user,c.oid,'INSERT')
        AND has_table_privilege(current_user,c.oid,'UPDATE') AND has_table_privilege(current_user,c.oid,'DELETE')) privileges
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex_hr' AND c.relkind='r'`)).rows;
    for (const table of ['grants', 'settings', 'employees', 'asos', 'vacations', 'audit', 'import_keys']) {
      const found = hr.find(row => row.relname === table);
      if (!found || !found.relrowsecurity || !found.relforcerowsecurity || !found.privileges) throw new Error('RH sem tabela, RLS forçada ou privilégios: ' + table);
    }
    const vault = (await client.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid='public.password_vaults'::regclass")).rows[0];
    if (!vault?.relrowsecurity || !vault?.relforcerowsecurity) throw new Error('Password vault RLS is required');
    const architecture = (await client.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid='public.architecture_projects'::regclass")).rows[0];
    if (!architecture?.relrowsecurity || !architecture?.relforcerowsecurity) throw new Error('Arquitetura exige RLS habilitada e forçada');
    const behavioral=(await client.query("SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid=ANY(ARRAY['public.behavioral_assessments'::regclass,'public.behavioral_drafts'::regclass,'public.behavioral_badges'::regclass])")).rows;
    if(behavioral.length!==3||behavioral.some(table=>!table.relrowsecurity||!table.relforcerowsecurity))throw new Error('Perfil Comportamental exige RLS habilitada e forçada');
    const schedules = (await client.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid=ANY(ARRAY['public.work_schedule_entries'::regclass,'public.work_schedule_operations'::regclass,'public.work_schedule_history'::regclass])")).rows;
    if (schedules.length !== 3 || schedules.some(table => !table.relrowsecurity || !table.relforcerowsecurity)) throw new Error('Escalas exige RLS habilitada e forçada');
    for (const [table, privileges] of [['work_schedule_entries', 'SELECT,INSERT,UPDATE'], ['work_schedule_operations', 'SELECT,INSERT'], ['work_schedule_history', 'SELECT,INSERT']]) {
      const access = await client.query("SELECT bool_and(has_table_privilege(current_user,$1,privilege)) AS allowed FROM unnest(string_to_array($2,',')) AS privilege", ['public.' + table, privileges]);
      if (!access.rows[0].allowed) throw new Error('Escalas sem privilégios em ' + table);
    }
    await client.query("SELECT nex_hr.actor_id(), nex_hr.allowed('rh.view')");
  }
  return { database: app.name, role: app.role, tablesChecked: tables.length, hr: beforeMigrations ? 'pending check after migrations' : 'RLS enabled and forced' };
}
async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--before-migrations')) throw new Error('Uso: deploy-check.mjs [--before-migrations]');
  const [nodeMajor, nodeMinor] = process.versions.node.split('.').map(Number);
  if (!((nodeMajor === 22 && nodeMinor >= 12) || nodeMajor === 24)) throw new Error('Use Node.js 22.12+ ou 24 LTS');
  if (process.env.NODE_ENV !== 'production') throw new Error('Configure NODE_ENV=production na VM');
  if (!process.env.CORS_ORIGINS?.split(',').some(value => /^https:\/\/[^/]+$/.test(value.trim()))) throw new Error('CORS_ORIGINS precisa conter a origem HTTPS real, sem barra final');
  const warnings = [];
  for (const [feature, configured] of [['e-mail', process.env.RESEND_API_KEY], ['Copiloto geral externo', process.env.OPENROUTER_API_KEY], ['Bitrix', process.env.BITRIX_WEBHOOK_URL]]) if (!configured) warnings.push(feature + ' não configurado (opcional)');
  for (const [label, directory] of Object.entries({ mediaUploadsDir, jrhUploadsDir, pcUploadsDir })) {
    await access(directory, constants.R_OK | constants.W_OK).catch(() => { throw new Error(`Diretório persistente ${label} ausente ou sem leitura/escrita: ${directory}`); });
  }
  await access(downloadsDir, constants.R_OK).catch(() => warnings.push('Distribuição desktop: DOWNLOADS_DIR ausente'));
  await access(new URL('../../dist/index.html', import.meta.url));
  await readFile(process.env.COPILOTO_AGENT_MD_PATH || new URL('../agents/copiloto.md', import.meta.url), 'utf8');
  const pool = runtimePool();
  try { console.log(JSON.stringify({ ...await checkDatabase(pool, { beforeMigrations: args.includes('--before-migrations') }), warnings }, null, 2)); }
  finally { await pool.end(); }
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) main().catch(error => { console.error('Pré-verificação recusada:', error.message); process.exitCode = 1; });
