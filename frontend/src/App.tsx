import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { OverviewPage } from './pages/OverviewPage';
import { UseCasesPage } from './pages/UseCasesPage';
import { UseCaseDetailPage } from './pages/UseCaseDetailPage';
import { ExecutiveInsightsPage } from './pages/ExecutiveInsightsPage';
import { AgentsPage } from './pages/AgentsPage';
import { ReportingAgentPage } from './pages/ReportingAgentPage';
import { MaintenanceAgentPage } from './pages/MaintenanceAgentPage';
import { SafetyQualityAgentPage } from './pages/SafetyQualityAgentPage';
import { AdminConsolePage } from './pages/AdminConsolePage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';
import { useStore } from './store';

function App() {
  const { token } = useStore();

  if (!token) {
    return <LoginPage />;
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<OverviewPage />} />
          <Route path="use-cases" element={<UseCasesPage />} />
          <Route path="use-cases/executive-insights" element={<ExecutiveInsightsPage />} />
          <Route path="use-cases/:id" element={<UseCaseDetailPage />} />
          <Route path="agents" element={<AgentsPage />} />
          <Route path="agents/reporting" element={<ReportingAgentPage />} />
          <Route path="agents/maintenance" element={<MaintenanceAgentPage />} />
          <Route path="agents/safety-quality" element={<SafetyQualityAgentPage />} />
          <Route path="reporting-agent" element={<ReportingAgentPage />} />
          <Route path="admin" element={<AdminConsolePage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
