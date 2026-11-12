export interface TaskMediaFile { id: string; name: string; file_url: string; file_type?: string; file_size?: number; created_at?: string; uploader_name?: string }
export const TASK_UPLOAD_ACCEPT: string;
export function taskUploadType(file: { name: string; type: string; size: number }): string;
export function safeTaskFileUrl(value: unknown): string | null;
export function taskMediaKind(file: { name: string; file_type?: string }): 'image' | 'video' | 'audio' | 'file';
export function taskMessageContent(text: string, files?: TaskMediaFile[]): string;
export function parseTaskMessage(content: string, files?: TaskMediaFile[]): { text: string; attachments: TaskMediaFile[] };
export function canAccessTaskFiles(task: { created_by?: string; owner_id?: string; assignees?: { id: string }[]; observers?: { id: string }[] } | null, actor: { id: string; role_name?: string } | null, adminRoles?: string[]): boolean;
export function descriptionImageMarkdown(file: TaskMediaFile): string;
export function taskDescriptionParts(content: string): Array<{ kind: 'text'; text: string } | { kind: 'image'; url: string; name: string }>;

export function taskDescriptionWithoutMedia(content: string, files?: {file_url?: string}[]): string;
