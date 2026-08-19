import { useEffect } from 'react';
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
import { PPEVisionAgentPage } from './pages/PPEVisionAgentPage';
import { PermitToWorkAgentPage } from './pages/PermitToWorkAgentPage';
import { IncidentInvestigationAgentPage } from './pages/IncidentInvestigationAgentPage';
import { SafetySiteIntelligencePage } from './pages/SafetySiteIntelligencePage';
import { AdminConsolePage } from './pages/AdminConsolePage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';
import { useStore } from './store';
import { IntegrationProvider } from './services/IntegrationContext';

function App() {
  const { token, fetchGovernanceSettings } = useStore();

  useEffect(() => {
    if (token) {
      // Sync governance settings from DB on app startup
      fetchGovernanceSettings();
    }
  }, [token, fetchGovernanceSettings]);

  if (!token) {
    return <LoginPage />;
  }

  return (
    <IntegrationProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<OverviewPage />} />
            <Route path="use-cases" element={<UseCasesPage />} />
            <Route path="use-cases/executive-insights" element={<ExecutiveInsightsPage />} />
            <Route path="use-cases/safety-site-intelligence" element={<SafetySiteIntelligencePage />} />
            <Route path="use-cases/:id" element={<UseCaseDetailPage />} />
            <Route path="agents" element={<AgentsPage />} />
            <Route path="agents/reporting" element={<ReportingAgentPage />} />
            <Route path="agents/maintenance" element={<MaintenanceAgentPage />} />
            <Route path="agents/safety-quality" element={<SafetyQualityAgentPage />} />
            <Route path="agents/ppe-vision" element={<PPEVisionAgentPage />} />
            <Route path="agents/permit-to-work" element={<PermitToWorkAgentPage />} />
            <Route path="agents/incident-investigation" element={<IncidentInvestigationAgentPage />} />
            <Route path="reporting-agent" element={<ReportingAgentPage />} />
            <Route path="permit-to-work-agent" element={<PermitToWorkAgentPage />} />
            <Route path="incident-investigation-agent" element={<IncidentInvestigationAgentPage />} />
            <Route path="admin" element={<AdminConsolePage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </Router>
    </IntegrationProvider>
  );
}

export default App;
