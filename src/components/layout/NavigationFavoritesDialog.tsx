import { useState } from 'react';
import { ArrowDown, ArrowUp, RotateCcw, Search, Star, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog';
import { MAX_NAVIGATION_FAVORITES, moveFavoriteRoute } from '../../../shared/navigationFavorites.mjs';
import { PRIMARY_NAVIGATION, type NavigationItem } from './navigation';

export function NavigationFavoritesDialog({ items, routes, onSave, onClose }: {
  items: NavigationItem[]; routes: string[]; onSave: (routes: string[]) => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState(() => routes.filter(route => items.some(item => item.to === route)));
  const [search, setSearch] = useState(''), [error, setError] = useState('');
  const selected = draft.flatMap(route => items.filter(item => item.to === route));
  const matches = items.filter(item => item.label.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
  function toggle(route: string) {
    setError('');
    if (draft.includes(route)) setDraft(value => value.filter(item => item !== route));
    else if (draft.length < MAX_NAVIGATION_FAVORITES) setDraft(value => [...value, route]);
    else setError(`Escolha até ${MAX_NAVIGATION_FAVORITES} atalhos. Remova um favorito para adicionar outro.`);
  }
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="navigation-favorites-dialog">
    <DialogTitle><Star size={21} />Sua REDE NEX, do seu jeito</DialogTitle>
    <DialogDescription>Favorite até {MAX_NAVIGATION_FAVORITES} páginas e organize a ordem dos atalhos. Sua preferência fica salva por usuário neste navegador.</DialogDescription>
    <section className="navigation-favorites-selected" aria-label="Ordem dos favoritos">
      <div className="navigation-favorites-section-heading"><h3>Seus atalhos <small>{draft.length}/{MAX_NAVIGATION_FAVORITES}</small></h3><button type="button" onClick={() => { setDraft(PRIMARY_NAVIGATION.filter(item => items.some(allowed => allowed.to === item.to)).map(item => item.to)); setError(''); }}><RotateCcw size={14} />Restaurar padrão</button></div>
      <ol>{selected.map((item, index) => <li key={item.to}><span className="navigation-favorite-number">{index + 1}</span><item.icon size={17} /><span>{item.label}</span><div>
        <button type="button" disabled={index === 0} aria-label={`Mover ${item.label} para antes`} onClick={() => setDraft(value => moveFavoriteRoute(value, item.to, -1))}><ArrowUp size={16} /></button>
        <button type="button" disabled={index === selected.length - 1} aria-label={`Mover ${item.label} para depois`} onClick={() => setDraft(value => moveFavoriteRoute(value, item.to, 1))}><ArrowDown size={16} /></button>
        <button type="button" aria-label={`Remover ${item.label} dos favoritos`} onClick={() => toggle(item.to)}><X size={16} /></button>
      </div></li>)}</ol>
      {!selected.length && <p>Sem atalhos selecionados. Os módulos continuam disponíveis em “Mais”.</p>}
    </section>
    <label className="nex-module-search"><Search size={17} /><input value={search} onChange={event => setSearch(event.target.value)} aria-label="Buscar página para favoritar" placeholder="Encontre uma página…" /></label>
    <div className="navigation-favorites-catalog" aria-label="Páginas disponíveis">{matches.map(item => <button key={item.to} type="button" aria-label={`Favoritar ${item.label}`} aria-pressed={draft.includes(item.to)} onClick={() => toggle(item.to)}><item.icon size={18} /><span>{item.label}</span><Star size={17} fill={draft.includes(item.to) ? 'currentColor' : 'none'} /></button>)}{!matches.length && <p>Nenhuma página encontrada.</p>}</div>
    {error && <p className="navigation-favorites-error" role="alert">{error}</p>}
    <footer><span>Mudar atalhos não altera suas permissões.</span><button type="button" onClick={onClose}>Cancelar</button><button type="button" onClick={() => { try { onSave(draft); onClose(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar os atalhos.'); } }}>Salvar atalhos</button></footer>
  </DialogContent></Dialog>;
}
