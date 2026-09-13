import { query } from './db.js';
import { cleanText } from './db_utils.js';

export async function listFolders(parentId = null) {
  const { rows } = await query(
    `select f.id, f.name, f.parent_id, f.created_at,
       json_build_object('id', u.id, 'name', u.name) as creator,
       (select count(*) from drive_folders sf where sf.parent_id = f.id) as subfolder_count,
       (select count(*) from drive_files df where df.folder_id = f.id) as file_count
     from drive_folders f left join users u on u.id = f.created_by
     where ($1::uuid is null and f.parent_id is null) or f.parent_id = $1
     order by f.name asc`,
    [parentId]
  );
  return rows;
}

export async function listFiles(folderId = null) {
  const { rows } = await query(
    `select f.id, f.name, f.file_url, f.file_type, f.file_size, f.folder_id, f.created_at,
       json_build_object('id', u.id, 'name', u.name, 'photo_url', u.photo_url) as creator
     from drive_files f left join users u on u.id = f.created_by
     where ($1::uuid is null and f.folder_id is null) or f.folder_id = $1
     order by f.created_at desc`,
    [folderId]
  );
  return rows;
}

export async function getFolder(id) {
  const { rows } = await query('select * from drive_folders where id=$1', [id]);
  return rows[0] || null;
}

export async function createFolder(userId, name, parentId = null) {
  const { rows } = await query(
    'insert into drive_folders (name, parent_id, created_by) values ($1,$2,$3) returning *',
    [cleanText(name, 255), parentId || null, userId]
  );
  return rows[0];
}

export async function deleteFolder(id) {
  await query('delete from drive_folders where id=$1', [id]);
  return true;
}

export async function createFile(userId, input) {
  const { rows } = await query(
    `insert into drive_files (name, file_url, file_type, file_size, folder_id, created_by)
     values ($1,$2,$3,$4,$5,$6) returning *`,
    [
      cleanText(input.name, 500),
      input.file_url,
      input.file_type || null,
      input.file_size || 0,
      input.folder_id || null,
      userId,
    ]
  );
  return rows[0];
}

export async function deleteFile(id) {
  await query('delete from drive_files where id=$1', [id]);
  return true;
}

export async function getFolderPath(folderId) {
  if (!folderId) return [];
  // Depth counter ensures correct ancestor order regardless of UUID sort
  const { rows } = await query(`
    with recursive path as (
      select id, name, parent_id, 0 as depth from drive_folders where id=$1
      union all
      select f.id, f.name, f.parent_id, p.depth+1 from drive_folders f join path p on p.parent_id = f.id
    )
    select id, name from path order by depth desc
  `, [folderId]);
  return rows;
}
