const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');

/** Validate against the complete directory, never a filtered/visible branch. */
export function canReparentDepartment(rows, id, parentId) {
  const parents = new Map(rows.map(row => [row.id, row.parent_id || null]));
  if (!parents.has(id)) return false;
  if (!parentId) return true;
  const seen = new Set([id]);
  let cursor = parentId;
  while (cursor) {
    if (seen.has(cursor) || !parents.has(cursor)) return false;
    seen.add(cursor);
    cursor = parents.get(cursor);
  }
  return true;
}

export function flattenOrgTree(tree) {
  const entries = [], seen = new Set();
  const visit = (nodes, depth) => {
    for (const node of nodes) {
      if (seen.has(node.id)) continue;
      seen.add(node.id);
      entries.push({ node, depth });
      visit(node.children || [], depth + 1);
    }
  };
  visit(tree, 0);
  return entries;
}

/** Keep ancestors as context; a matching department keeps its whole branch. */
export function filterOrgTree(tree, search) {
  const term = normalize(search).trim();
  if (!term) return tree;
  const visit = nodes => nodes.flatMap(node => {
    if (normalize([node.name, node.manager_name, node.manager_position].join(' ')).includes(term)) return [node];
    const children = visit(node.children || []);
    return children.length ? [{ ...node, children }] : [];
  });
  return visit(tree);
}
