import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Grid2X2, Search } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../lib/auth';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '../ui/sheet';
import { PRIMARY_NAVIGATION, navigationForRole } from './navigation';

export function MobileBottomNav() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { user } = useAuth();
  const items = navigationForRole(user?.roles?.name || user?.role_name || 'Usuário');
  const filtered = items.filter(item => item.label.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));

  return (
    <nav className="nex-bottom-nav" aria-label="Navegação principal no celular">
      {PRIMARY_NAVIGATION.map(item => (
        <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => cn('nex-bottom-link', isActive && 'active')}>
          <item.icon size={21} aria-hidden="true" /><span>{item.label}</span>
        </NavLink>
      ))}
      <Sheet open={open} onOpenChange={value => { setOpen(value); if (!value) setSearch(''); }}>
        <SheetTrigger asChild>
          <button type="button" className={cn('nex-bottom-link', open && 'active')} aria-label="Abrir todos os módulos">
            <Grid2X2 size={21} aria-hidden="true" /><span>Mais</span>
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="nex-navigation-sheet rounded-t-2xl">
          <SheetHeader className="text-left pr-8">
            <SheetTitle>Seu espaço de trabalho</SheetTitle>
            <SheetDescription>Acesse todos os módulos da REDE NEX.</SheetDescription>
          </SheetHeader>
          <label className="nex-module-search">
            <Search size={18} aria-hidden="true" />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Encontrar módulo…" aria-label="Encontrar módulo" />
          </label>
          <div className="nex-module-grid">
            {filtered.map(item => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={() => { setOpen(false); setSearch(''); }} className={({ isActive }) => cn('nex-module-link', isActive && 'active')}>
                <item.icon size={21} aria-hidden="true" /><span>{item.label}</span>
              </NavLink>
            ))}
            {!filtered.length && <p className="col-span-full py-6 text-center text-sm text-muted-foreground">Nenhum módulo encontrado. Tente outro nome.</p>}
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
