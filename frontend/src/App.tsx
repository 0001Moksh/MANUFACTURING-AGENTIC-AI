import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { OverviewPage } from './pages/OverviewPage';
import { UseCasesPage } from './pages/UseCasesPage';
import { AgentsPage } from './pages/AgentsPage';
import { AdminConsolePage } from './pages/AdminConsolePage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SettingsPage } from './pages/SettingsPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<OverviewPage />} />
          <Route path="use-cases" element={<UseCasesPage />} />
          <Route path="agents" element={<AgentsPage />} />
          <Route path="admin" element={<AdminConsolePage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;