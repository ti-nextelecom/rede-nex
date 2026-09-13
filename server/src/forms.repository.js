import { query } from './db.js';
import { cleanText } from './db_utils.js';

export async function listForms(userId, isAdmin = false) {
  const { rows } = await query(
    `select f.id, f.title, f.description, f.published, f.created_at, f.updated_at,
       json_build_object('id', u.id, 'name', u.name, 'photo_url', u.photo_url) as creator,
       (select count(*) from form_responses r where r.form_id = f.id) as response_count,
       jsonb_array_length(f.fields) as field_count
     from forms f left join users u on u.id = f.created_by
     ${isAdmin ? '' : 'where f.created_by=$1 or f.published=true'}
     order by f.updated_at desc`,
    isAdmin ? [] : [userId]
  );
  return rows;
}

export async function getForm(id) {
  const { rows } = await query(
    `select f.*,
       json_build_object('id', u.id, 'name', u.name, 'photo_url', u.photo_url) as creator,
       (select count(*) from form_responses r where r.form_id = f.id) as response_count
     from forms f left join users u on u.id = f.created_by
     where f.id=$1`,
    [id]
  );
  return rows[0] || null;
}

export async function createForm(userId, input) {
  const { rows } = await query(
    `insert into forms (title, description, fields, published, created_by)
     values ($1,$2,$3,$4,$5) returning id`,
    [
      cleanText(input.title, 500),
      cleanText(input.description || '', 2000) || null,
      JSON.stringify(input.fields || []),
      !!input.published,
      userId,
    ]
  );
  return getForm(rows[0].id);
}

export async function updateForm(id, input) {
  const fields = [], values = [];
  let i = 1;
  if (input.title !== undefined)       { fields.push(`title=$${i++}`);       values.push(cleanText(input.title, 500)); }
  if (input.description !== undefined) { fields.push(`description=$${i++}`); values.push(cleanText(input.description, 2000) || null); }
  if (input.fields !== undefined)      { fields.push(`fields=$${i++}`);      values.push(JSON.stringify(input.fields)); }
  if (input.published !== undefined)   { fields.push(`published=$${i++}`);   values.push(!!input.published); }
  if (fields.length) {
    fields.push('updated_at=now()');
    values.push(id);
    await query(`update forms set ${fields.join(',')} where id=$${i}`, values);
  }
  return getForm(id);
}

export async function deleteForm(id) {
  await query('delete from forms where id=$1', [id]);
  return true;
}

export async function submitResponse(formId, userId, answers) {
  const { rows } = await query(
    'insert into form_responses (form_id, user_id, answers) values ($1,$2,$3) returning *',
    [formId, userId, JSON.stringify(answers)]
  );
  return rows[0];
}

export async function listResponses(formId) {
  const { rows } = await query(
    `select r.id, r.answers, r.submitted_at,
       json_build_object('id', u.id, 'name', u.name, 'photo_url', u.photo_url) as user
     from form_responses r left join users u on u.id = r.user_id
     where r.form_id=$1 order by r.submitted_at desc`,
    [formId]
  );
  return rows;
}

export async function hasResponded(formId, userId) {
  const { rows } = await query(
    'select 1 from form_responses where form_id=$1 and user_id=$2',
    [formId, userId]
  );
  return rows.length > 0;
}
