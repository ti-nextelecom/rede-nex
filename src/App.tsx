import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import { GamificationToast } from './components/GamificationToast';
import { GlobalNotifications } from './components/GlobalNotifications';
import { GlobalCallOverlay } from './components/GlobalCallOverlay';
import { WsManager } from './components/WsManager';
import { Layout } from './components/layout/Layout';

const Dashboard   = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Feed        = lazy(() => import('./pages/Feed').then(m => ({ default: m.Feed })));
const Training    = lazy(() => import('./pages/Training').then(m => ({ default: m.Training })));
const Wiki        = lazy(() => import('./pages/Wiki').then(m => ({ default: m.Wiki })));
const Users       = lazy(() => import('./pages/Users').then(m => ({ default: m.Users })));
const Permissions = lazy(() => import('./pages/Permissions').then(m => ({ default: m.Permissions })));
const Login       = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Chat        = lazy(() => import('./pages/Chat').then(m => ({ default: m.Chat })));
const Tasks       = lazy(() => import('./pages/Tasks').then(m => ({ default: m.Tasks })));
const Profile     = lazy(() => import('./pages/Profile').then(m => ({ default: m.Profile })));
const Logs        = lazy(() => import('./pages/Logs').then(m => ({ default: m.Logs })));
const Departments = lazy(() => import('./pages/Departments').then(m => ({ default: m.Departments })));
const Ranking     = lazy(() => import('./pages/Ranking').then(m => ({ default: m.Ranking })));
const CalendarPage   = lazy(() => import('./pages/CalendarPage').then(m => ({ default: m.CalendarPage })));
const DrivePage      = lazy(() => import('./pages/DrivePage').then(m => ({ default: m.DrivePage })));
const FormsPage      = lazy(() => import('./pages/FormsPage').then(m => ({ default: m.FormsPage })));
const SignPage        = lazy(() => import('./pages/SignPage').then(m => ({ default: m.SignPage })));
const WhiteboardPage = lazy(() => import('./pages/WhiteboardPage').then(m => ({ default: m.WhiteboardPage })));
const AnalyticsPage  = lazy(() => import('./pages/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })));
const NotasPage      = lazy(() => import('./pages/NotasPage').then(m => ({ default: m.NotasPage })));
const AjudaPage      = lazy(() => import('./pages/AjudaPage').then(m => ({ default: m.AjudaPage })));
const CopilotoPage   = lazy(() => import('./pages/CopilotoPage').then(m => ({ default: m.CopilotoPage })));
const OrgChartPage      = lazy(() => import('./pages/OrgChartPage').then(m => ({ default: m.OrgChartPage })));
const ConfiguracoesPage = lazy(() => import('./pages/ConfiguracoesPage').then(m => ({ default: m.ConfiguracoesPage })));
const ProjetosPage      = lazy(() => import('./pages/ProjetosPage').then(m => ({ default: m.ProjetosPage })));
const PrestacaoContasPage = lazy(() => import('./pages/PrestacaoContasPage').then(m => ({ default: m.PrestacaoContasPage })));
const JRHPage          = lazy(() => import('./pages/JRHPage').then(m => ({ default: m.JRHPage })));
const ForgotPassword   = lazy(() => import('./pages/ForgotPassword').then(m => ({ default: m.ForgotPassword })));
const ResetPassword    = lazy(() => import('./pages/ResetPassword').then(m => ({ default: m.ResetPassword })));
const PainelTIPage = lazy(() => import('./pages/PainelTIPage').then(m => ({ default: m.PainelTIPage })));


class RouteErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error('[RouteErrorBoundary]', error); }
  render() {
    if (this.state.error) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8">
          <div className="text-4xl">⚠️</div>
          <p className="text-slate-700 font-semibold text-center">Erro ao carregar o chat</p>
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-3 max-w-lg text-center font-mono break-all whitespace-pre-wrap">{this.state.error?.message || String(this.state.error)}</p>
          <button onClick={() => { this.setState({ error: null }); window.location.reload(); }}
            className="px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600">
            Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function PageFallback() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center gap-4">
        <img src="/assets/images/favicon_copa.png" alt="Rede Nex" className="h-16 w-16 rounded-2xl animate-pulse" />
        <span className="text-slate-400 text-sm">Carregando...</span>
      </div>
    );
  }
  return user ? children : <Navigate to="/login" replace />;
}

function GlobalNotificationsMount() {
  const { user } = useAuth();
  if (!user) return null;
  return <GlobalNotifications />;
}

function App() {
  return (
    <AuthProvider>
      <GamificationToast />
      <BrowserRouter>
        <WsManager />
        <GlobalNotificationsMount />
        <GlobalCallOverlay />
        <Suspense fallback={null}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/esqueci-senha" element={<Suspense fallback={null}><ForgotPassword /></Suspense>} />
            <Route path="/redefinir-senha" element={<Suspense fallback={null}><ResetPassword /></Suspense>} />
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="/" element={<Suspense fallback={<PageFallback />}><Dashboard /></Suspense>} />
              <Route path="/feed" element={<Suspense fallback={<PageFallback />}><Feed /></Suspense>} />
              <Route path="/jrh" element={<Suspense fallback={<PageFallback />}><JRHPage /></Suspense>} />
              <Route path="/treinamentos" element={<Suspense fallback={<PageFallback />}><Training /></Suspense>} />
              <Route path="/wiki" element={<Suspense fallback={<PageFallback />}><Wiki /></Suspense>} />
              <Route path="/colaboradores" element={<Suspense fallback={<PageFallback />}><Users /></Suspense>} />
              <Route path="/bate-papo" element={<RouteErrorBoundary><Suspense fallback={<PageFallback />}><Chat /></Suspense></RouteErrorBoundary>} />
              <Route path="/tarefas" element={<Suspense fallback={<PageFallback />}><Tasks /></Suspense>} />
              <Route path="/perfil" element={<Suspense fallback={<PageFallback />}><Profile /></Suspense>} />
              <Route path="/permissoes" element={<Suspense fallback={<PageFallback />}><Permissions /></Suspense>} />
              <Route path="/departamentos" element={<Suspense fallback={<PageFallback />}><Departments /></Suspense>} />
              <Route path="/logs" element={<Suspense fallback={<PageFallback />}><Logs /></Suspense>} />
              <Route path="/ranking" element={<Suspense fallback={<PageFallback />}><Ranking /></Suspense>} />
              <Route path="/calendario" element={<Suspense fallback={<PageFallback />}><CalendarPage /></Suspense>} />
              <Route path="/drive" element={<Suspense fallback={<PageFallback />}><DrivePage /></Suspense>} />
              <Route path="/formularios" element={<Suspense fallback={<PageFallback />}><FormsPage /></Suspense>} />
              <Route path="/assinatura" element={<Suspense fallback={<PageFallback />}><SignPage /></Suspense>} />
              <Route path="/lousas" element={<Suspense fallback={<PageFallback />}><WhiteboardPage /></Suspense>} />
              <Route path="/analytics" element={<Suspense fallback={<PageFallback />}><AnalyticsPage /></Suspense>} />
              <Route path="/notas" element={<Suspense fallback={<PageFallback />}><NotasPage /></Suspense>} />
              <Route path="/ajuda" element={<Suspense fallback={<PageFallback />}><AjudaPage /></Suspense>} />
              <Route path="/copiloto" element={<Suspense fallback={<PageFallback />}><CopilotoPage /></Suspense>} />
              <Route path="/organograma" element={<Suspense fallback={<PageFallback />}><OrgChartPage /></Suspense>} />
              <Route path="/configuracoes" element={<Suspense fallback={<PageFallback />}><ConfiguracoesPage /></Suspense>} />
              <Route path="/projetos" element={<Suspense fallback={<PageFallback />}><ProjetosPage /></Suspense>} />
              <Route path="/prestacao-contas" element={<Suspense fallback={<PageFallback />}><PrestacaoContasPage /></Suspense>} />
              <Route path="/gestao-ti" element={<Suspense fallback={<PageFallback />}><PainelTIPage /></Suspense>} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
