import { pool } from './db.js';
import { mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { resolve as pathResolve } from 'node:path';

export const implUploadsDir = pathResolve(process.env.IMPL_UPLOADS_DIR || '/opt/rede-nex/deploy_v2/uploads/implementation');
mkdirSync(implUploadsDir, { recursive: true });

export async function listDemands(filters = {}) {
  let q = `
    SELECT d.*,
      u.name AS creator_name, u.photo_url AS creator_photo,
      au.name AS assigned_name
    FROM implementation_demands d
    JOIN users u ON u.id = d.created_by
    LEFT JOIN users au ON au.id = d.assigned_to
  `;
  const conditions = [], vals = [];
  if (filters.stage) { conditions.push(`d.stage = $${conditions.length + 1}`); vals.push(filters.stage); }
  if (filters.type)  { conditions.push(`d.type = $${conditions.length + 1}`);  vals.push(filters.type); }
  if (conditions.length) q += ' WHERE ' + conditions.join(' AND ');
  q += ' ORDER BY d.created_at DESC';
  const res = await pool.query(q, vals);
  return res.rows;
}

export async function getDemand(id) {
  const res = await pool.query(`
    SELECT d.*, u.name AS creator_name, u.photo_url AS creator_photo, au.name AS assigned_name
    FROM implementation_demands d
    JOIN users u ON u.id = d.created_by
    LEFT JOIN users au ON au.id = d.assigned_to
    WHERE d.id = $1
  `, [id]);
  return res.rows[0] || null;
}

export async function createDemand(data) {
  const res = await pool.query(`
    INSERT INTO implementation_demands (title, description, type, priority, deadline, created_by)
    VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
  `, [
    data.title,
    data.description || '',
    data.type || 'implementacao',
    data.priority || 'media',
    data.deadline || null,
    data.created_by,
  ]);
  return res.rows[0];
}

export async function updateDemand(id, data) {
  const allowed = ['title', 'description', 'stage', 'priority', 'deadline', 'assigned_to', 'type'];
  const fields = [], vals = [];
  let i = 1;
  for (const [k, v] of Object.entries(data)) {
    if (!allowed.includes(k)) continue;
    fields.push(`${k} = $${i++}`);
    vals.push(v === '' ? null : v);
  }
  if (!fields.length) return null;
  fields.push('updated_at = NOW()');
  vals.push(id);
  const res = await pool.query(
    `UPDATE implementation_demands SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
    vals
  );
  return res.rows[0] || null;
}

export async function deleteDemand(id) {
  await pool.query('DELETE FROM implementation_demands WHERE id = $1', [id]);
}

export async function listDemandComments(demandId) {
  const res = await pool.query(`
    SELECT c.*, u.name AS user_name, u.photo_url AS user_photo
    FROM implementation_demand_comments c
    JOIN users u ON u.id = c.user_id
    WHERE c.demand_id = $1
    ORDER BY c.created_at ASC
  `, [demandId]);
  return res.rows;
}

export async function addDemandComment(demandId, userId, content) {
  const res = await pool.query(`
    INSERT INTO implementation_demand_comments (demand_id, user_id, content)
    VALUES ($1, $2, $3) RETURNING *
  `, [demandId, userId, content]);
  return res.rows[0];
}

export async function listDemandFiles(demandId) {
  const res = await pool.query(`
    SELECT f.*, u.name AS user_name
    FROM implementation_demand_files f
    JOIN users u ON u.id = f.user_id
    WHERE f.demand_id = $1
    ORDER BY f.created_at ASC
  `, [demandId]);
  return res.rows;
}

export async function addDemandFile(demandId, userId, base64Data, originalName, mimeType) {
  const ext = extname(String(originalName)).toLowerCase() || '.bin';
  const filename = randomUUID() + ext;
  const buffer = Buffer.from(String(base64Data), 'base64');
  if (buffer.length > 20 * 1024 * 1024) throw new Error('Arquivo muito grande (máx 20MB)');
  writeFileSync(join(implUploadsDir, filename), buffer);
  const res = await pool.query(`
    INSERT INTO implementation_demand_files (demand_id, user_id, filename, original_name, mime_type, size_bytes)
    VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
  `, [demandId, userId, filename, originalName, mimeType || 'application/octet-stream', buffer.length]);
  return res.rows[0];
}

export async function deleteDemandFileById(fileId, requestingUserId, isAdmin) {
  const r = await pool.query('SELECT filename, user_id FROM implementation_demand_files WHERE id = $1', [fileId]);
  if (!r.rows[0]) throw new Error('Arquivo não encontrado');
  if (!isAdmin && r.rows[0].user_id !== requestingUserId) throw new Error('Sem permissão para excluir este arquivo');
  try { unlinkSync(join(implUploadsDir, r.rows[0].filename)); } catch {}
  await pool.query('DELETE FROM implementation_demand_files WHERE id = $1', [fileId]);
}
