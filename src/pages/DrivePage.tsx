import { useEffect, useRef, useState } from 'react';
import {
  ChevronRight, File, FileText, Film, FolderOpen, FolderPlus, Image,
  Music, Trash2, Upload, X,
} from 'lucide-react';
import { apiDelete, apiGet, apiPost } from '../lib/apiClient';
import { cn } from '../lib/utils';

interface DriveFolder { id: string; name: string; parent_id?: string; subfolder_count: number; file_count: number; creator?: { name: string }; created_at: string; }
interface DriveFile { id: string; name: string; file_url: string; file_type?: string; file_size: number; created_at: string; creator?: { id: string; name: string; photo_url?: string }; }
interface DriveData { folders: DriveFolder[]; files: DriveFile[]; path: { id: string; name: string }[]; }

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b/1024).toFixed(1)} KB`;
  return `${(b/1048576).toFixed(1)} MB`;
}

function FileIcon({ type }: { type?: string }) {
  if (!type) return <File size={20} className="text-slate-400" />;
  if (type.startsWith('image/')) return <Image size={20} className="text-blue-400" />;
  if (type.startsWith('video/')) return <Film size={20} className="text-purple-400" />;
  if (type.startsWith('audio/')) return <Music size={20} className="text-pink-400" />;
  if (type.includes('pdf')) return <FileText size={20} className="text-red-400" />;
  return <FileText size={20} className="text-slate-400" />;
}

function uploadFile(file: File, folderId: string | null): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await apiPost<{ data: { public_url: string } }>('/drive/media', {
          data: reader.result, file_name: file.name, file_type: file.type,
        });
        await apiPost('/drive/files', {
          name: file.name, file_url: res.data.public_url,
          file_type: file.type, file_size: file.size, folder_id: folderId,
        });
        resolve();
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function DrivePage() {
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [data, setData] = useState<DriveData>({ folders: [], files: [], path: [] });
  const [loading, setLoading] = useState(true);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async (folderId: string | null = currentFolder) => {
    setLoading(true);
    try {
      const qs = folderId ? `?parent_id=${folderId}` : '';
      const res = await apiGet<{ data: DriveData }>(`/drive/folders${qs}`);
      setData(res.data ?? { folders: [], files: [], path: [] });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(currentFolder); }, [currentFolder]);

  const navigate = (id: string | null) => setCurrentFolder(id);

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    await apiPost('/drive/folders', { name: newFolderName.trim(), parent_id: currentFolder });
    setNewFolderName(''); setShowNewFolder(false);
    await load();
  };

  const deleteFolder = async (id: string) => {
    if (!confirm('Remover esta pasta e todo o seu conteúdo?')) return;
    await apiDelete(`/drive/folders/${id}`); await load();
  };

  const deleteFile = async (id: string) => {
    if (!confirm('Remover este arquivo?')) return;
    await apiDelete(`/drive/files/${id}`); await load();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      await Promise.all(files.map(f => uploadFile(f, currentFolder)));
      await load();
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <FolderOpen size={20} className="text-orange-500" />
          <h1 className="text-lg font-bold text-slate-800">Drive</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowNewFolder(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors min-h-[40px]">
            <FolderPlus size={15} /> <span className="hidden sm:inline">Nova pasta</span>
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-60 min-h-[40px]">
            <Upload size={15} /> {uploading ? 'Enviando...' : 'Upload'}
          </button>
          <input ref={fileRef} type="file" multiple className="hidden" onChange={handleUpload} />
        </div>
      </div>

      {/* Breadcrumb — scrollable */}
      <div className="flex items-center gap-1 text-sm text-slate-500 overflow-x-auto pb-1 flex-nowrap">
        <button onClick={() => navigate(null)} className="hover:text-orange-600 font-medium transition-colors flex-shrink-0">Drive</button>
        {data.path.map((p, i) => (
          <span key={p.id} className="flex items-center gap-1 flex-shrink-0">
            <ChevronRight size={13} />
            <button onClick={() => navigate(p.id)}
              className={cn('hover:text-orange-600 transition-colors whitespace-nowrap', i === data.path.length - 1 && 'text-slate-800 font-semibold')}>
              {p.name}
            </button>
          </span>
        ))}
      </div>

      {/* New folder input */}
      {showNewFolder && (
        <div className="flex items-center gap-2 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
          <FolderOpen size={16} className="text-orange-400 flex-shrink-0" />
          <input autoFocus value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createFolder(); if (e.key === 'Escape') setShowNewFolder(false); }}
            placeholder="Nome da pasta" className="flex-1 bg-transparent text-sm outline-none text-slate-800 min-w-0" />
          <button onClick={createFolder} className="px-2.5 py-1.5 bg-orange-500 text-white text-xs font-semibold rounded min-h-[36px]">Criar</button>
          <button onClick={() => setShowNewFolder(false)} className="text-slate-400 hover:text-slate-600 p-1"><X size={15} /></button>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-slate-400 text-sm">Carregando...</div>
      ) : data.folders.length === 0 && data.files.length === 0 ? (
        <div className="py-12 text-center bg-white border border-slate-200 rounded-xl">
          <FolderOpen size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">Pasta vazia</p>
          <p className="text-sm text-slate-400 mt-1">Faça upload de arquivos ou crie uma nova pasta</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {data.folders.length > 0 && (
            <>
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pastas</span>
              </div>
              <div className="divide-y divide-slate-50">
                {data.folders.map(f => (
                  <div key={f.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 active:bg-slate-100 group transition-colors">
                    <FolderOpen size={20} className="text-orange-400 flex-shrink-0" />
                    <button onClick={() => navigate(f.id)} className="flex-1 text-left min-w-0">
                      <p className="text-sm font-semibold text-slate-800 hover:text-orange-600 transition-colors truncate">{f.name}</p>
                      <p className="text-xs text-slate-400">
                        {f.subfolder_count} pasta{Number(f.subfolder_count) !== 1 ? 's' : ''} · {f.file_count} arquivo{Number(f.file_count) !== 1 ? 's' : ''}
                      </p>
                    </button>
                    <button onClick={() => deleteFolder(f.id)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-all opacity-0 group-hover:opacity-100 min-w-[36px] min-h-[36px] flex items-center justify-center">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
          {data.files.length > 0 && (
            <>
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 border-t">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Arquivos</span>
              </div>
              <div className="divide-y divide-slate-50">
                {data.files.map(f => (
                  <div key={f.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 active:bg-slate-100 group transition-colors">
                    <FileIcon type={f.file_type} />
                    <a href={f.file_url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 hover:text-orange-600 truncate transition-colors">{f.name}</p>
                      <p className="text-xs text-slate-400">
                        {formatBytes(f.file_size)} · {new Date(f.created_at).toLocaleDateString('pt-BR')}
                        {f.creator && ` · ${f.creator.name}`}
                      </p>
                    </a>
                    <button onClick={() => deleteFile(f.id)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-all opacity-0 group-hover:opacity-100 min-w-[36px] min-h-[36px] flex items-center justify-center">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
