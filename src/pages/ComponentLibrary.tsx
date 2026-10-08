/**
 * Component Library Documentation & Examples
 * 
 * Este arquivo demonstra como usar todos os componentes modernos da aplicação.
 * Serve como referência para desenvolvedores e como showcase do design system.
 */

import {
  Button,
} from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from '@/components/ui/avatar';
import { DashboardStats, ActivityFeed } from '@/components/Dashboard';
import { TrendingUp, Users, MessageSquare, Star } from 'lucide-react';

/**
 * BUTTONS SHOWCASE
 * Todos os variants disponíveis para botões
 */
export function ButtonShowcase() {
  return (
    <Card variant="glass" className="p-6">
      <CardHeader>
        <CardTitle>Botões - Todos os Variants</CardTitle>
        <CardDescription>Clique para interagir</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Gradiente Primário</h4>
          <div className="flex gap-2 flex-wrap">
            <Button variant="gradient-primary" size="sm">Pequeno</Button>
            <Button variant="gradient-primary">Normal</Button>
            <Button variant="gradient-primary" size="lg">Grande</Button>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Gradiente Secundário</h4>
          <div className="flex gap-2 flex-wrap">
            <Button variant="gradient-secondary" size="sm">Pequeno</Button>
            <Button variant="gradient-secondary">Normal</Button>
            <Button variant="gradient-secondary" size="lg">Grande</Button>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Gradiente Accent</h4>
          <div className="flex gap-2 flex-wrap">
            <Button variant="gradient-accent" size="sm">Pequeno</Button>
            <Button variant="gradient-accent">Normal</Button>
            <Button variant="gradient-accent" size="lg">Grande</Button>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Glass Effect</h4>
          <div className="flex gap-2 flex-wrap">
            <Button variant="glass">Glass Default</Button>
            <Button variant="glass-primary">Glass Primary</Button>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Neon</h4>
          <div className="flex gap-2 flex-wrap">
            <Button variant="neon">Neon Effect</Button>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Estados</h4>
          <div className="flex gap-2 flex-wrap">
            <Button disabled>Desativado</Button>
            <Button variant="gradient-primary" className="opacity-50">Opaco</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * CARDS SHOWCASE
 * Diferentes estilos de cards
 */
export function CardsShowcase() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card variant="default">
        <CardHeader>
          <CardTitle>Card Default</CardTitle>
          <CardDescription>Estilo clássico</CardDescription>
        </CardHeader>
        <CardContent>
          Conteúdo padrão sem efeitos especiais.
        </CardContent>
      </Card>

      <Card variant="glass">
        <CardHeader>
          <CardTitle>Card Glass</CardTitle>
          <CardDescription>Efeito glassmorphism</CardDescription>
        </CardHeader>
        <CardContent>
          Com backdrop blur e transparência.
        </CardContent>
      </Card>

      <Card variant="gradient">
        <CardHeader>
          <CardTitle>Card Gradient</CardTitle>
          <CardDescription>Fundo com gradiente</CardDescription>
        </CardHeader>
        <CardContent>
          Gradiente suave de cores primárias.
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * BADGES SHOWCASE
 * Todos os estilos de badges disponíveis
 */
export function BadgesShowcase() {
  return (
    <Card variant="glass" className="p-6">
      <CardHeader>
        <CardTitle>Badges - Todos os Variants</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Básicos</h4>
          <div className="flex gap-2 flex-wrap">
            <Badge variant="default">Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="destructive">Destructive</Badge>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Modernos</h4>
          <div className="flex gap-2 flex-wrap">
            <Badge variant="glass">Glass</Badge>
            <Badge variant="glass-primary">Glass Primary</Badge>
            <Badge variant="glow-primary">Glow Primary</Badge>
            <Badge variant="gradient-primary">Gradient Primary</Badge>
            <Badge variant="gradient-secondary">Gradient Secondary</Badge>
            <Badge variant="neon">Neon</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * INPUTS SHOWCASE
 * Diferentes tipos de inputs
 */
export function InputsShowcase() {
  return (
    <Card variant="glass" className="p-6">
      <CardHeader>
        <CardTitle>Inputs - Todos os Variants</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Input Default</label>
          <Input variant="default" placeholder="Digite algo..." />
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Input Glass</label>
          <Input variant="glass" placeholder="Com glassmorphism..." />
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Input Gradient</label>
          <Input variant="gradient" placeholder="Com gradiente..." />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * AVATARS SHOWCASE
 * Diferentes tamanhos e estilos
 */
export function AvatarsShowcase() {
  return (
    <Card variant="glass" className="p-6">
      <CardHeader>
        <CardTitle>Avatars - Tamanhos e Estilos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Tamanhos</h4>
          <div className="flex items-center gap-4">
            <Avatar size="sm">
              <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=User" />
              <AvatarFallback>SM</AvatarFallback>
            </Avatar>
            <Avatar size="md">
              <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=User" />
              <AvatarFallback>MD</AvatarFallback>
            </Avatar>
            <Avatar size="lg">
              <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=User" />
              <AvatarFallback>LG</AvatarFallback>
            </Avatar>
            <Avatar size="xl">
              <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=User" />
              <AvatarFallback>XL</AvatarFallback>
            </Avatar>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Com Glow Effect</h4>
          <div className="flex gap-4">
            <Avatar glow size="lg">
              <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=User" />
              <AvatarFallback>GL</AvatarFallback>
            </Avatar>
            <Avatar glow size="lg">
              <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=User2" />
              <AvatarFallback>GL</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * DASHBOARD COMPONENTS SHOWCASE
 * Métricas e atividades
 */
export function DashboardShowcase() {
  const mockMetrics = [
    {
      icon: <Users size={24} className="text-primary" />,
      label: 'Usuários Ativos',
      value: '12,345',
      change: { value: 8, trend: 'up' as const },
      variant: 'gradient' as const,
    },
    {
      icon: <MessageSquare size={24} className="text-blue-500" />,
      label: 'Mensagens',
      value: '5,678',
      change: { value: 12, trend: 'up' as const },
      variant: 'gradient' as const,
    },
    {
      icon: <Star size={24} className="text-yellow-500" />,
      label: 'Avaliações',
      value: '4.8/5',
      change: { value: 2, trend: 'up' as const },
      variant: 'gradient' as const,
    },
    {
      icon: <TrendingUp size={24} className="text-green-500" />,
      label: 'Crescimento',
      value: '34%',
      change: { value: 5, trend: 'up' as const },
      variant: 'gradient' as const,
    },
  ];

  const mockActivities = [
    {
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=User1',
      name: 'João Silva',
      title: 'Desenvolvedor',
      description: 'Criou um novo projeto',
      timestamp: 'Há 5 minutos',
      status: 'active' as const,
    },
    {
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=User2',
      name: 'Maria Santos',
      title: 'Designer',
      description: 'Atualizou o design system',
      timestamp: 'Há 30 minutos',
      status: 'idle' as const,
    },
    {
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=User3',
      name: 'Pedro Costa',
      title: 'Product Manager',
      description: 'Comentou no roadmap',
      timestamp: 'Há 2 horas',
      status: 'offline' as const,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Métricas</h3>
        <DashboardStats metrics={mockMetrics} />
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Atividades Recentes</h3>
        <ActivityFeed items={mockActivities} className="max-w-2xl" />
      </div>
    </div>
  );
}

/**
 * MAIN COMPONENT LIBRARY
 */
export function ComponentLibrary() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-card py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Biblioteca de Componentes
          </h1>
          <p className="text-text-secondary">
            Todos os componentes modernos com design futurista
          </p>
        </div>

        {/* Buttons */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground">Botões</h2>
          <ButtonShowcase />
        </section>

        {/* Cards */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground">Cards</h2>
          <CardsShowcase />
        </section>

        {/* Badges */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground">Badges</h2>
          <BadgesShowcase />
        </section>

        {/* Inputs */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground">Inputs</h2>
          <InputsShowcase />
        </section>

        {/* Avatars */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground">Avatars</h2>
          <AvatarsShowcase />
        </section>

        {/* Dashboard */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
          <DashboardShowcase />
        </section>

        {/* Color Palette */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground">Paleta de Cores</h2>
          <Card variant="glass" className="p-6">
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { name: 'Primary', color: 'bg-primary' },
                  { name: 'Secondary', color: 'bg-secondary' },
                  { name: 'Accent', color: 'bg-accent' },
                  { name: 'Success', color: 'bg-green-500' },
                  { name: 'Warning', color: 'bg-yellow-500' },
                  { name: 'Destructive', color: 'bg-red-500' },
                  { name: 'Muted', color: 'bg-muted' },
                  { name: 'Card', color: 'bg-card' },
                ].map((color) => (
                  <div key={color.name} className="space-y-2">
                    <div className={`${color.color} h-24 rounded-lg shadow-lg`} />
                    <p className="text-sm font-medium text-center">{color.name}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Animations Reference */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground">Animações</h2>
          <Card variant="glass" className="p-6">
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Pulse</p>
                  <div className="w-12 h-12 bg-primary rounded-lg animate-pulse" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Bounce</p>
                  <div className="w-12 h-12 bg-primary rounded-lg animate-bounce" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Spin</p>
                  <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Fade In</p>
                  <div className="w-12 h-12 bg-primary rounded-lg animate-fade-in" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Scale In</p>
                  <div className="w-12 h-12 bg-primary rounded-lg animate-scale-in" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Float</p>
                  <div className="w-12 h-12 bg-primary rounded-lg animate-float" />
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Footer */}
        <div className="text-center pt-8 border-t border-white/10">
          <p className="text-sm text-text-secondary">
            Design System v1.0 • Criado com React + Tailwind + TypeScript
          </p>
        </div>
      </div>
    </div>
  );
}

export default ComponentLibrary;
