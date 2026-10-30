export interface OrgNode {
  id: string; name: string; parent_id: string | null;
  manager_name: string | null; manager_photo: string | null; manager_position: string | null;
  user_count: number; children: OrgNode[];
}
export function flattenOrgTree(tree: OrgNode[]): { node: OrgNode; depth: number }[];
export function filterOrgTree(tree: OrgNode[], search: string): OrgNode[];
export function canReparentDepartment(rows: { id: string; parent_id?: string | null }[], id: string, parentId: string | null): boolean;
