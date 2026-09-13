import { query } from './db.js';
import { cleanText } from './db_utils.js';

const docSelect = `
  select
    d.id, d.title, d.file_url, d.created_at,
    json_build_object('id', u.id, 'name', u.name, 'photo_url', u.photo_url) as creator,
    coalesce((
      select json_agg(json_build_object(
        'id', r.id, 'status', r.status, 'signed_at', r.signed_at,
        'user', json_build_object('id', u2.id, 'name', u2.name, 'photo_url', u2.photo_url)
      ) order by u2.name)
      from sign_requests r join users u2 on u2.id = r.user_id
      where r.document_id = d.id
    ), '[]') as requests
  from sign_documents d left join users u on u.id = d.created_by
`;

export async function listDocuments(userId) {
  const { rows } = await query(
    `${docSelect}
     where d.created_by=$1 or exists (select 1 from sign_requests r where r.document_id=d.id and r.user_id=$1)
     order by d.created_at desc`,
    [userId]
  );
  return rows;
}

export async function getDocument(id) {
  const { rows } = await query(`${docSelect} where d.id=$1`, [id]);
  return rows[0] || null;
}

export async function createDocument(userId, input) {
  const { rows } = await query(
    'insert into sign_documents (title, file_url, created_by) values ($1,$2,$3) returning id',
    [cleanText(input.title, 500), input.file_url, userId]
  );
  const docId = rows[0].id;
  if (input.signer_ids?.length) {
    await query(
      `insert into sign_requests (document_id, user_id)
       select $1, uid from unnest($2::uuid[]) as uid on conflict do nothing`,
      [docId, input.signer_ids]
    );
  }
  return getDocument(docId);
}

export async function signDocument(documentId, userId, ipAddress) {
  await query(
    `update sign_requests set status='signed', signed_at=now(), ip_address=$3
     where document_id=$1 and user_id=$2 and status='pending'`,
    [documentId, userId, ipAddress]
  );
  return getDocument(documentId);
}

export async function rejectDocument(documentId, userId) {
  await query(
    `update sign_requests set status='rejected'
     where document_id=$1 and user_id=$2 and status='pending'`,
    [documentId, userId]
  );
  return getDocument(documentId);
}

export async function deleteDocument(id) {
  await query('delete from sign_documents where id=$1', [id]);
  return true;
}
