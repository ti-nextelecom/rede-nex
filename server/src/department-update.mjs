import { canReparentDepartment } from '../../shared/orgTree.mjs';

// Pure parameterized update plan, shared by the repository and regression tests.
export function departmentUpdatePlan(id, { name, description, manager_id, parent_id }) {
  const fields = [], values = [];
  const add = (field, value) => { values.push(value); fields.push(`${field} = $${values.length}`); };
  if (name !== undefined) {
    const clean = String(name ?? '').trim().slice(0, 100);
    if (!clean) throw Object.assign(new Error('Nome obrigatório'), { statusCode: 400, code: 'VALIDATION_ERROR' });
    add('name', clean);
  }
  if (description !== undefined) add('description', description ? String(description).trim().slice(0, 500) : null);
  if (manager_id !== undefined) add('manager_id', manager_id || null);
  if (parent_id !== undefined) add('parent_id', parent_id || null);
  if (!fields.length) throw Object.assign(new Error('Nenhum campo para atualizar'), { statusCode: 400, code: 'VALIDATION_ERROR' });
  values.push(id);
  return { text: `update departments set ${fields.join(', ')} where id = $${values.length} returning *`, values };
}

// Injected pool keeps transaction boundaries testable without a live database.
export async function saveDepartmentHierarchy(pool, id, parentId, plan) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // This namespace is dedicated to hierarchy edits across application workers.
    await client.query('SELECT pg_advisory_xact_lock(73124, 1)');
    const directory = await client.query('SELECT id, parent_id FROM departments');
    if (!directory.rows.some(row => row.id === id)) { await client.query('ROLLBACK'); return null; }
    if (!canReparentDepartment(directory.rows, id, parentId || null)) {
      throw Object.assign(new Error('Setor superior inválido: a hierarquia não pode formar ciclos.'), { statusCode: 400, code: 'VALIDATION_ERROR' });
    }
    const { rows } = await client.query(plan.text, plan.values);
    await client.query('COMMIT');
    return rows[0] || null;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
