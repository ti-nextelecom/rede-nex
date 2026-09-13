import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { query } from './db.js';

const uploadRoot = join(process.cwd(), 'public', 'uploads', 'pc-anexos');

export async function isPcAdmin(userId) {
  const r = await query('SELECT 1 FROM pc_admins WHERE user_id = $1', [userId]);
  return r.rowCount > 0;
}

async function requirePcAdmin(req, res, user, sendError) {
  const ok = await isPcAdmin(user.id);
  if (!ok) { sendError(req, res, 403, 'FORBIDDEN', 'Acesso restrito'); return false; }
  return true;
}
export { requirePcAdmin };

// ── Permissões ────────────────────────────────────────────

export async function getUserPcPapel(userId) {
  const adminCheck = await query('SELECT 1 FROM pc_admins WHERE user_id = $1', [userId]);
  if (adminCheck.rowCount > 0) return 'admin';
  const r = await query('SELECT papel FROM pc_permissoes WHERE user_id = $1 LIMIT 1', [userId]);
  return r.rows[0]?.papel || null;
}

export async function hasPcAccess(userId) {
  const papel = await getUserPcPapel(userId);
  return papel !== null;
}

export async function listPcPermissoes() {
  const r = await query(`
    SELECT p.*, u.name AS user_name, u.email AS user_email, u.photo_url AS user_photo
    FROM pc_permissoes p
    JOIN users u ON u.id = p.user_id
    ORDER BY u.name
  `);
  return r.rows;
}

export async function createPcPermissao({ user_id, papel }) {
  const r = await query(
    `INSERT INTO pc_permissoes (user_id, papel)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET papel = EXCLUDED.papel
     RETURNING *`,
    [user_id, papel]
  );
  return r.rows[0];
}

export async function deletePcPermissao(id) {
  await query('DELETE FROM pc_permissoes WHERE id = $1', [id]);
}

export async function updateLancamentoStatus(id, { status, validado_por, obs = null }) {
  const r = await query(
    `UPDATE pc_lancamentos SET status=$1, validado_por=$2, validado_em=NOW(), validacao_obs=$3
     WHERE id=$4 RETURNING *`,
    [status, validado_por, obs, id]
  );
  return r.rows[0];
}

// ── Setores ──────────────────────────────────────────────
export async function listSetores() {
  const r = await query(`
    SELECT s.*,
      COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'aberto')::int AS periodos_abertos,
      COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'atrasado')::int AS periodos_atrasados,
      COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'inconsistencia')::int AS periodos_inconsistentes,
      COALESCE(SUM(l.valor) FILTER (WHERE p.status IN ('aberto','atrasado','aguardando_validacao','inconsistencia')),0) AS saldo_aberto,
      ru.name AS responsavel_nome,
      vl.name AS validador_nome
    FROM pc_setores s
    LEFT JOIN pc_periodos p ON p.setor_id = s.id
    LEFT JOIN pc_lancamentos l ON l.periodo_id = p.id
    LEFT JOIN users ru ON ru.id = s.responsavel_user_id
    LEFT JOIN users vl ON vl.id = s.validador_user_id
    WHERE s.ativo = true
    GROUP BY s.id, ru.name, vl.name
    ORDER BY s.nome
  `);
  return r.rows;
}

export async function createSetor({ nome, card_last4, responsavel, responsavel_user_id, card_brand, validador_user_id }) {
  const r = await query(
    `INSERT INTO pc_setores (nome, card_last4, responsavel, responsavel_user_id, card_brand, validador_user_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [nome, card_last4 || null, responsavel || null, responsavel_user_id || null, card_brand || null, validador_user_id || null]
  );
  return r.rows[0];
}

export async function updateSetor(id, { nome, card_last4, responsavel, responsavel_user_id, ativo, card_brand, validador_user_id }) {
  const r = await query(
    `UPDATE pc_setores SET nome=$1, card_last4=$2, responsavel=$3, responsavel_user_id=$4, ativo=$5, card_brand=$6, validador_user_id=$7
     WHERE id=$8 RETURNING *`,
    [nome, card_last4 || null, responsavel || null, responsavel_user_id || null, ativo !== false, card_brand || null, validador_user_id || null, id]
  );
  return r.rows[0];
}

export async function deleteSetor(id) {
  await query('DELETE FROM pc_lancamentos WHERE periodo_id IN (SELECT id FROM pc_periodos WHERE setor_id=$1)', [id]);
  await query('DELETE FROM pc_periodos WHERE setor_id=$1', [id]);
  const r = await query('DELETE FROM pc_setores WHERE id=$1 RETURNING id', [id]);
  return r.rowCount > 0;
}

// ── Periodos ─────────────────────────────────────────────
export async function listPeriodos(setor_id) {
  await query(
    `UPDATE pc_periodos SET status = 'atrasado'
     WHERE setor_id = $1 AND status = 'aberto'
       AND CURRENT_DATE >= (DATE_TRUNC('month', data_fim) + INTERVAL '1 month 5 days')`,
    [setor_id]
  );
  const r = await query(
    `SELECT p.*,
      COALESCE(SUM(l.valor),0) AS total_gasto,
      COUNT(l.id) AS qtd_lancamentos,
      ru.name AS responsavel_nome,
      vp.name AS validado_por_nome
     FROM pc_periodos p
     LEFT JOIN pc_lancamentos l ON l.periodo_id = p.id
     LEFT JOIN users ru ON ru.id = p.responsavel_user_id
     LEFT JOIN users vp ON vp.id = p.validado_por
     WHERE p.setor_id = $1
     GROUP BY p.id, ru.name, vp.name
     ORDER BY p.data_inicio DESC`,
    [setor_id]
  );
  return r.rows;
}

export async function createPeriodo({ setor_id, periodo, data_inicio, data_fim, responsavel, responsavel_user_id }) {
  const r = await query(
    `INSERT INTO pc_periodos (setor_id, periodo, data_inicio, data_fim, responsavel, responsavel_user_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [setor_id, periodo, data_inicio, data_fim, responsavel || null, responsavel_user_id || null]
  );
  return r.rows[0];
}

export async function closePeriodo(id) {
  const r = await query(
    `UPDATE pc_periodos SET status='fechado' WHERE id=$1 RETURNING *`,
    [id]
  );
  return r.rows[0];
}

// ── Lançamentos ───────────────────────────────────────────
export async function listLancamentos(periodo_id) {
  const r = await query(
    `SELECT l.*, u.name AS autor_nome, vp.name AS validado_por_nome,
      COUNT(c.id) AS qtd_comentarios,
      COUNT(a.id) AS qtd_anexos
     FROM pc_lancamentos l
     LEFT JOIN users u ON u.id = l.created_by
     LEFT JOIN users vp ON vp.id = l.validado_por
     LEFT JOIN pc_comentarios c ON c.lancamento_id = l.id
     LEFT JOIN pc_anexos a ON a.lancamento_id = l.id
     WHERE l.periodo_id = $1
     GROUP BY l.id, u.name, vp.name
     ORDER BY l.data, l.created_at`,
    [periodo_id]
  );
  return r.rows;
}

export async function getLancamento(id) {
  const r = await query(
    `SELECT l.*, u.name AS autor_nome, vp.name AS validado_por_nome
     FROM pc_lancamentos l
     LEFT JOIN users u ON u.id = l.created_by
     LEFT JOIN users vp ON vp.id = l.validado_por
     WHERE l.id = $1`,
    [id]
  );
  return r.rows[0];
}

export async function createLancamento({ periodo_id, data, data_compra, fornecedor, descricao, numero_documento, valor, forma_pagamento, parcelado, num_parcelas, setor_area, observacoes, created_by }) {
  const r = await query(
    `INSERT INTO pc_lancamentos
       (periodo_id, data, data_compra, fornecedor, descricao, numero_documento, valor, forma_pagamento, parcelado, num_parcelas, setor_area, observacoes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING *`,
    [periodo_id, data, data_compra || null, fornecedor || null, descricao, numero_documento || null, valor, forma_pagamento || null, parcelado || false, num_parcelas || null, setor_area || null, observacoes || null, created_by]
  );
  return r.rows[0];
}

export async function updateLancamento(id, { data, data_compra, fornecedor, descricao, numero_documento, valor, forma_pagamento, parcelado, num_parcelas, setor_area, observacoes }) {
  const r = await query(
    `UPDATE pc_lancamentos SET
       data=$1, data_compra=$2, fornecedor=$3, descricao=$4, numero_documento=$5,
       valor=$6, forma_pagamento=$7, parcelado=$8, num_parcelas=$9,
       setor_area=$10, observacoes=$11,
       updated_at=NOW()
     WHERE id=$12 RETURNING *`,
    [data, data_compra || null, fornecedor || null, descricao, numero_documento || null, valor, forma_pagamento || null, parcelado || false, num_parcelas || null, setor_area || null, observacoes || null, id]
  );
  return r.rows[0];
}

export async function deleteLancamento(id) {
  const anexos = await query('SELECT caminho FROM pc_anexos WHERE lancamento_id=$1', [id]);
  await query('DELETE FROM pc_lancamentos WHERE id=$1', [id]);
  for (const a of anexos.rows) {
    try { await unlink(join(process.cwd(), 'public', a.caminho)); } catch {}
  }
}

// ── Comentários ───────────────────────────────────────────
export async function listComentarios(lancamento_id) {
  const r = await query(
    `SELECT c.*, u.name AS autor_nome
     FROM pc_comentarios c
     LEFT JOIN users u ON u.id = c.autor_id
     WHERE c.lancamento_id = $1
     ORDER BY c.created_at`,
    [lancamento_id]
  );
  return r.rows;
}

export async function createComentario({ lancamento_id, autor_id, texto }) {
  const r = await query(
    `INSERT INTO pc_comentarios (lancamento_id, autor_id, texto)
     VALUES ($1,$2,$3) RETURNING *`,
    [lancamento_id, autor_id, texto]
  );
  return r.rows[0];
}

// ── Anexos ────────────────────────────────────────────────
export async function listAnexos(lancamento_id) {
  const r = await query(
    `SELECT a.*, u.name AS autor_nome
     FROM pc_anexos a
     LEFT JOIN users u ON u.id = a.uploaded_by
     WHERE a.lancamento_id = $1
     ORDER BY a.created_at`,
    [lancamento_id]
  );
  return r.rows;
}

export async function saveAnexo({ lancamento_id, uploaded_by, file_name, file_type, data }) {
  const base64 = String(data).includes(',') ? String(data).split(',').pop() : String(data);
  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length) throw new Error('Arquivo vazio');
  if (buffer.length > 20 * 1024 * 1024) throw new Error('Arquivo maior que 20MB');

  const ext = extname(file_name || '').toLowerCase() || '.bin';
  const fileName = `${randomUUID()}${ext}`;
  const relativePath = `uploads/pc-anexos/${fileName}`;

  await mkdir(uploadRoot, { recursive: true });
  await writeFile(join(uploadRoot, fileName), buffer);

  const r = await query(
    `INSERT INTO pc_anexos (lancamento_id, nome_original, caminho, tamanho, mime_type, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [lancamento_id, file_name, relativePath, buffer.length, file_type || null, uploaded_by]
  );
  return { ...r.rows[0], public_url: `/${relativePath}` };
}

export async function getAnexo(id) {
  const r = await query('SELECT * FROM pc_anexos WHERE id=$1', [id]);
  return r.rows[0];
}

export async function deleteAnexo(id) {
  const r = await query('SELECT caminho FROM pc_anexos WHERE id=$1', [id]);
  if (!r.rows[0]) return;
  await query('DELETE FROM pc_anexos WHERE id=$1', [id]);
  try { await unlink(join(process.cwd(), 'public', 'uploads', 'pc-anexos', r.rows[0].caminho.split('/').pop())); } catch {}
}

export async function streamAnexo(id) {
  const r = await query('SELECT * FROM pc_anexos WHERE id=$1', [id]);
  if (!r.rows[0]) return null;
  const a = r.rows[0];
  const filePath = join(process.cwd(), 'public', 'uploads', 'pc-anexos', a.caminho.split('/').pop());
  const buffer = await readFile(filePath);
  return { buffer, mime_type: a.mime_type || 'application/octet-stream', nome_original: a.nome_original };
}

// ── Fatura (extrato do período) ───────────────────────────
export async function getFatura(periodo_id) {
  const [periodo, lancamentos] = await Promise.all([
    query(`SELECT p.*, s.nome AS setor_nome, s.card_last4
           FROM pc_periodos p JOIN pc_setores s ON s.id=p.setor_id
           WHERE p.id=$1`, [periodo_id]),
    query(`SELECT l.*, u.name AS autor_nome
           FROM pc_lancamentos l LEFT JOIN users u ON u.id=l.created_by
           WHERE l.periodo_id=$1 ORDER BY l.data, l.created_at`, [periodo_id])
  ]);
  const p = periodo.rows[0];
  if (!p) return null;
  const total = lancamentos.rows.reduce((s, l) => s + parseFloat(l.valor), 0);
  return { periodo: p, lancamentos: lancamentos.rows, total };
}

// ── Workflow de Validação de Período ─────────────────────────────

export async function submitPeriodo(id, user_id) {
  const r = await query(
    `UPDATE pc_periodos SET status='aguardando_validacao', data_submissao=NOW(), submetido_por=$2
     WHERE id=$1 AND status IN ('aberto','atrasado') RETURNING *`,
    [id, user_id]
  );
  return r.rows[0];
}

export async function validarPeriodo(id, user_id) {
  const r = await query(
    `UPDATE pc_periodos SET status='validado', validado_por=$2, validado_em=NOW()
     WHERE id=$1 AND status='aguardando_validacao' RETURNING *`,
    [id, user_id]
  );
  if (r.rows[0]) {
    await query(
      `UPDATE pc_lancamentos SET status='aprovado', validado_por=$2, validado_em=NOW()
       WHERE periodo_id=$1 AND status='pendente'`,
      [id, user_id]
    );
  }
  return r.rows[0];
}

export async function inconsistenciaPeriodo(id, { user_id, texto }) {
  await query(
    `UPDATE pc_periodos SET status='inconsistencia'
     WHERE id=$1 AND status='aguardando_validacao'`,
    [id]
  );
  await query(
    `INSERT INTO pc_comentarios_periodo (periodo_id, autor_id, tipo, texto)
     VALUES ($1,$2,'inconsistencia',$3)`,
    [id, user_id, texto]
  );
  const r = await query('SELECT * FROM pc_periodos WHERE id=$1', [id]);
  return r.rows[0];
}

export async function corrigirPeriodo(id, user_id, texto) {
  const r = await query(
    `UPDATE pc_periodos SET status='aguardando_validacao', data_submissao=NOW(), submetido_por=$2
     WHERE id=$1 AND status='inconsistencia' RETURNING *`,
    [id, user_id]
  );
  if (r.rows[0]) {
    const msg = texto || 'Responsável marcou como corrigido e resubmeteu para validação.';
    await query(
      `INSERT INTO pc_comentarios_periodo (periodo_id, autor_id, tipo, texto)
       VALUES ($1,$2,'correcao',$3)`,
      [id, user_id, msg]
    );
  }
  return r.rows[0];
}

export async function listComentariosPeriodo(periodo_id) {
  const r = await query(
    `SELECT c.*, u.name AS autor_nome
     FROM pc_comentarios_periodo c
     LEFT JOIN users u ON u.id = c.autor_id
     WHERE c.periodo_id = $1
     ORDER BY c.created_at`,
    [periodo_id]
  );
  return r.rows;
}

export async function createComentarioPeriodo({ periodo_id, autor_id, texto }) {
  const r = await query(
    `INSERT INTO pc_comentarios_periodo (periodo_id, autor_id, tipo, texto)
     VALUES ($1,$2,'comentario',$3) RETURNING *`,
    [periodo_id, autor_id, texto]
  );
  return r.rows[0];
}
