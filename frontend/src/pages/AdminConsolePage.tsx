import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { UsersTable } from '../components/admin/UsersTable';
import { ConnectorsGrid } from '../components/admin/ConnectorsGrid';
import { RulesBuilder } from '../components/admin/RulesBuilder';
import { useStore } from '../store';
import { Settings2, Eye, PencilLine, Search, Trash2 } from 'lucide-react';
import { HITLSettingsModal } from '../components/admin/HITLSettingsModal';
import { api } from '../services/api';

import { GuardrailsTable } from '../components/admin/GuardrailsTable';

export const AdminConsolePage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { explainableLogs, humanInLoop, toggleGovernanceSetting } = useStore();
  const [showHitlModal, setShowHitlModal] = useState(false);
  const [activePane, setActivePane] = useState(() => {
    const pane = new URLSearchParams(location.search).get('pane');
    return pane === 'notifications' || pane === 'users' || pane === 'sites' || pane === 'integrations' || pane === 'guardrails' || pane === 'rules' ? pane : 'users';
  });
  const [notifications, setNotifications] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [notificationFilter, setNotificationFilter] = useState('all');
  const [sites, setSites] = useState<any[]>([]);
  const [siteSearch, setSiteSearch] = useState('');
  const [siteStatusFilter, setSiteStatusFilter] = useState('ALL');
  const [siteLocationFilter, setSiteLocationFilter] = useState('ALL');
  const [siteConnectivityFilter, setSiteConnectivityFilter] = useState('ALL');
  const [viewSite, setViewSite] = useState<any | null>(null);
  const [editSite, setEditSite] = useState<any | null>(null);
  const [deleteSiteId, setDeleteSiteId] = useState<number | null>(null);

  useEffect(() => {
    const pane = new URLSearchParams(location.search).get('pane');
    if (pane === 'notifications' || pane === 'users' || pane === 'sites' || pane === 'integrations' || pane === 'guardrails' || pane === 'rules') {
      setActivePane(pane);
    }
  }, [location.search]);

  const loadSites = async () => {
    try {
      const response = await api.get('/admin/sites');
      setSites(Array.isArray(response.data) ? response.data : []);
    } catch {
      setSites([]);
    }
  };

  useEffect(() => {
    if (activePane !== 'sites') return;
    void loadSites();
  }, [activePane]);

  useEffect(() => {
    if (activePane !== 'notifications') return;
    void api.get('/notifications', { params: notificationFilter === 'all' ? {} : { category: notificationFilter } })
      .then((response) => setNotifications(response.data))
      .catch(() => setNotifications([]));
    void api.get('/report-approvals').then((response) => setApprovals(response.data)).catch(() => setApprovals([]));
  }, [activePane, notificationFilter]);

  const decideApproval = async (approvalKey: string, decision: 'approve' | 'reject') => {
    await api.post(`/report-approvals/${approvalKey}/${decision}`, { note: '' });
    setApprovals((items) => items.map((item) => item.approval_key === approvalKey ? { ...item, status: decision === 'approve' ? 'SENT' : 'REJECTED' } : item));
  };

  const normalizedConnectivity = (value?: string) => {
    if (!value) return 'Pending';
    const normalized = value.toLowerCase();
    if (normalized.includes('offline')) return 'Offline';
    if (normalized.includes('online') || normalized.includes('edge + cloud') || normalized.includes('hybrid')) return 'Online';
    return 'Pending';
  };

  const siteRows = useMemo(() => {
    return sites.map((site) => ({
      ...site,
      normalizedStatus: site.status || 'Active',
      normalizedConnectivity: normalizedConnectivity(site.connectivity),
      normalizedModules: site.modules_live ?? 0,
      normalizedAgents: site.agents_count ?? 0,
    }));
  }, [sites]);

  const locationOptions = useMemo(() => Array.from(new Set(siteRows.map((site) => site.location).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [siteRows]);
  const connectivityOptions = useMemo(() => ['Online', 'Offline', 'Pending'], []);
  const statusOptions = useMemo(() => ['Active', 'Live', 'Inactive'], []);

  const filteredSites = useMemo(() => {
    return siteRows.filter((site) => {
      const matchesSearch = !siteSearch || `${site.name || ''} ${site.location || ''}`.toLowerCase().includes(siteSearch.toLowerCase());
      const matchesStatus = siteStatusFilter === 'ALL' || site.normalizedStatus === siteStatusFilter;
      const matchesLocation = siteLocationFilter === 'ALL' || site.location === siteLocationFilter;
      const matchesConnectivity = siteConnectivityFilter === 'ALL' || site.normalizedConnectivity === siteConnectivityFilter;
      return matchesSearch && matchesStatus && matchesLocation && matchesConnectivity;
    });
  }, [siteRows, siteSearch, siteStatusFilter, siteLocationFilter, siteConnectivityFilter]);

  const handleSiteDelete = async (siteId: number) => {
    try {
      await api.delete(`/admin/sites/${siteId}`);
      setDeleteSiteId(null);
      await loadSites();
    } catch {
      window.alert('Unable to delete this site right now.');
    }
  };

  const handleSiteUpdate = async (site: any) => {
    try {
      await api.put(`/admin/sites/${site.id}`, {
        name: site.name,
        location: site.location,
        description: site.description,
        status: site.status,
      });
      setEditSite(null);
      await loadSites();
    } catch {
      window.alert('Unable to update this site right now.');
    }
  };

  const panes = [
    { id: 'users', label: 'Users & Roles' },
    { id: 'sites', label: 'Sites & Plants' },
    { id: 'integrations', label: 'Integrations' },
    { id: 'guardrails', label: 'Governance & Guardrails' },
    { id: 'rules', label: 'Alert & Escalation Rules' },
    { id: 'notifications', label: 'Notifications' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-6"
    >
      <div className="mb-[20px]">
        <h2 className="font-head text-[24px] m-[0_0_6px] font-extrabold text-ink">
          Platform governance, integrations & usability controls
        </h2>
        <p className="m-0 text-muted text-[13.5px] max-w-[720px] leading-relaxed">
          Everything below is configurable per plant, per role — this is what convinces a Digital Head the platform is enterprise-ready, not a science project.
        </p>
      </div>

      <div className="flex gap-[6px] mb-[18px] flex-wrap border-b border-border-color">
        {panes.map(p => (
          <button
            key={p.id}
            onClick={() => {
              setActivePane(p.id);
              navigate(`/admin?pane=${p.id}`);
            }}
            className={`bg-transparent border-none p-[10px_4px] mr-[18px] text-[13px] font-semibold transition-colors cursor-pointer border-b-2 ${
              activePane === p.id ? 'text-ink border-teal' : 'text-muted border-transparent hover:text-ink'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activePane}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.2 }}
        >
          {activePane === 'users' && <UsersTable />}

          {activePane === 'sites' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="relative w-full max-w-[320px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input
                    value={siteSearch}
                    onChange={(e) => setSiteSearch(e.target.value)}
                    placeholder="Search site or location"
                    className="w-full rounded-[10px] border border-border-color bg-white py-2.5 pl-9 pr-3 text-[12px] text-ink focus:outline-none focus:border-teal"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/admin/sites/new')}
                  className="rounded-[10px] bg-teal px-4 py-2 text-[12px] font-bold text-white cursor-pointer"
                >
                  Add Site
                </button>
              </div>

              <div className="bg-panel border border-border-color rounded-[14px] overflow-hidden">
                <table className="w-full border-collapse text-[12.5px]">
                  <thead>
                    <tr>
                      <th className="text-left text-[10.5px] uppercase tracking-[0.5px] text-faint p-[10px_16px] border-b border-border-color font-bold bg-[#FBFCFE]">Site / Plant Name</th>
                      <th className="text-left text-[10.5px] uppercase tracking-[0.5px] text-faint p-[10px_16px] border-b border-border-color font-bold bg-[#FBFCFE]">
                        <div className="flex items-center gap-2">
                          <span>Location</span>
                          <select value={siteLocationFilter} onChange={(e) => setSiteLocationFilter(e.target.value)} className="rounded border border-border-color bg-white px-1.5 py-1 text-[10px] text-ink focus:outline-none">
                            <option value="ALL">All</option>
                            {locationOptions.map((location) => (
                              <option key={location} value={location}>{location}</option>
                            ))}
                          </select>
                        </div>
                      </th>
                      <th className="text-left text-[10.5px] uppercase tracking-[0.5px] text-faint p-[10px_16px] border-b border-border-color font-bold bg-[#FBFCFE]">Live Modules</th>
                      <th className="text-left text-[10.5px] uppercase tracking-[0.5px] text-faint p-[10px_16px] border-b border-border-color font-bold bg-[#FBFCFE]">Agents</th>
                      <th className="text-left text-[10.5px] uppercase tracking-[0.5px] text-faint p-[10px_16px] border-b border-border-color font-bold bg-[#FBFCFE]">
                        <div className="flex items-center gap-2">
                          <span>Connectivity</span>
                          <select value={siteConnectivityFilter} onChange={(e) => setSiteConnectivityFilter(e.target.value)} className="rounded border border-border-color bg-white px-1.5 py-1 text-[10px] text-ink focus:outline-none">
                            <option value="ALL">All</option>
                            {connectivityOptions.map((option) => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                        </div>
                      </th>
                      <th className="text-left text-[10.5px] uppercase tracking-[0.5px] text-faint p-[10px_16px] border-b border-border-color font-bold bg-[#FBFCFE]">
                        <div className="flex items-center gap-2">
                          <span>Status</span>
                          <select value={siteStatusFilter} onChange={(e) => setSiteStatusFilter(e.target.value)} className="rounded border border-border-color bg-white px-1.5 py-1 text-[10px] text-ink focus:outline-none">
                            <option value="ALL">All</option>
                            {statusOptions.map((option) => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                        </div>
                      </th>
                      <th className="text-left text-[10.5px] uppercase tracking-[0.5px] text-faint p-[10px_16px] border-b border-border-color font-bold bg-[#FBFCFE]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSites.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-[12px] text-muted">No sites match the current search or filters.</td>
                      </tr>
                    ) : (
                      filteredSites.map((site: any) => (
                        <tr key={site.id ?? site.name} className="border-b border-[#F0F2F7] last:border-b-0 hover:bg-[#FAFBFF]">
                          <td className="p-[12px_16px] font-bold align-middle text-ink">{site.name}</td>
                          <td className="p-[12px_16px] align-middle text-muted">{site.location || site.region || '—'}</td>
                          <td className="p-[12px_16px] align-middle text-ink">{site.normalizedModules}</td>
                          <td className="p-[12px_16px] align-middle text-ink">{site.normalizedAgents}</td>
                          <td className="p-[12px_16px] align-middle">
                            <span className={`inline-flex rounded-[20px] px-[8px] py-[3px] text-[10px] font-bold ${
                              site.normalizedConnectivity === 'Online' ? 'bg-green-tint text-green' :
                              site.normalizedConnectivity === 'Offline' ? 'bg-red-50 text-red-600' : 'bg-[#EEF0F5] text-muted'}
                            `}>
                              {site.normalizedConnectivity}
                            </span>
                          </td>
                          <td className="p-[12px_16px] align-middle">
                            <span className={`inline-flex rounded-[20px] px-[8px] py-[3px] text-[10px] font-bold ${
                              site.normalizedStatus === 'Active' ? 'bg-green-tint text-green' :
                              site.normalizedStatus === 'Live' ? 'bg-blue-tint text-[#2258b0]' : 'bg-[#EEF0F5] text-muted'}
                            `}>
                              {site.normalizedStatus}
                            </span>
                          </td>
                          <td className="p-[12px_16px] align-middle">
                            <div className="flex items-center gap-2">
                              <button type="button" title="View site" onClick={() => setViewSite(site)} className="rounded-[6px] border border-border-color bg-white p-1.5 text-muted hover:text-ink cursor-pointer"><Eye className="h-3.5 w-3.5" /></button>
                              <button type="button" title="Edit site" onClick={() => setEditSite(site)} className="rounded-[6px] border border-border-color bg-white p-1.5 text-muted hover:text-ink cursor-pointer"><PencilLine className="h-3.5 w-3.5" /></button>
                              <button type="button" title="Delete site" onClick={() => setDeleteSiteId(site.id)} className="rounded-[6px] border border-border-color bg-white p-1.5 text-muted hover:text-red-600 cursor-pointer"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activePane === 'integrations' && <ConnectorsGrid />}
          
          {activePane === 'guardrails' && (
            <div className="flex flex-col gap-6">
              {/* ── Master Governance Switches ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  {
                    key: 'explainability_logging',
                    label: 'Explainability Logging',
                    desc: 'Every AI decision is traceable — inputs, model version and reasoning summary retained.',
                    isOn: explainableLogs,
                  },
                  {
                    key: 'hitl_approval',
                    label: 'Human-in-the-Loop Approval for High-Risk Actions',
                    desc: 'Required before any agent commits a production, safety or financial action above threshold.',
                    isOn: humanInLoop,
                  },
                ].map(({ key, label, desc, isOn }) => (
                  <div key={key} className="flex items-center gap-[14px] bg-panel border border-border-color rounded-[11px] p-[13px_16px] hover:border-teal/40 transition-colors">
                    <div className="flex-1">
                      <div className="font-bold text-[13px] mb-[2px]">{label}</div>
                      <div className="text-[11.5px] text-muted">{desc}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      {key === 'hitl_approval' && (
                        <button title="HITL settings" onClick={() => setShowHitlModal(true)} className="p-2 rounded hover:bg-gray-100"><Settings2 className="w-4 h-4 text-muted" /></button>
                      )}
                      <button
                        onClick={() => toggleGovernanceSetting(key, !isOn)}
                        className={`w-[34px] h-[19px] rounded-[20px] relative border-none shrink-0 transition-colors cursor-pointer ${
                          isOn ? 'bg-green' : 'bg-[#D7DCE8]'
                        }`}
                      >
                        <div className={`absolute w-[15px] h-[15px] bg-white rounded-full top-[2px] transition-all duration-200 shadow-sm ${
                          isOn ? 'right-[2px]' : 'left-[2px]'
                        }`} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Dynamic Policy Guardrails Management ── */}
              <GuardrailsTable />
            </div>
          )}
          
          {activePane === 'rules' && <RulesBuilder />}

          {activePane === 'notifications' && (
            <div className="bg-panel border border-border-color rounded-[14px] overflow-hidden">
              <div className="p-4 border-b border-border-color flex items-center justify-between gap-3 flex-wrap"><div><div className="font-head text-[15px] font-bold text-ink">Notification History</div><div className="text-[11.5px] text-muted">Same persisted feed shown in the platform notification bell.</div></div><div className="flex gap-1.5">{[['all', 'All'], ['human_intervention', 'Human Intervention'], ['system', 'System'], ['alert', 'Alerts']].map(([value, label]) => <button key={value} onClick={() => setNotificationFilter(value)} className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold border cursor-pointer ${notificationFilter === value ? 'bg-navy-900 text-white border-navy-900' : 'bg-panel text-muted border-border-color'}`}>{label}</button>)}</div></div>
              {approvals.filter((approval) => approval.status === 'PENDING_APPROVAL').map((approval) => <div key={approval.approval_key} className="mx-4 mt-4 rounded-[12px] border border-amber/40 bg-amber-tint/50 p-3.5 flex items-center gap-3 flex-wrap"><div className="flex-1 min-w-[240px]"><div className="text-[12.5px] font-bold text-[#7C5200]">Daily Operations report requires approval</div><div className="mt-1 text-[11px] text-[#9A6400] line-clamp-2">{approval.query}</div></div>{approval.report_url && <a href={approval.report_url} target="_blank" rel="noreferrer" className="text-[11px] font-bold text-[#805300]">Review PDF</a>}<button onClick={() => void decideApproval(approval.approval_key, 'reject')} className="rounded-[8px] border border-amber/50 bg-panel px-2.5 py-1.5 text-[11px] font-bold text-[#805300] cursor-pointer">Reject</button><button onClick={() => void decideApproval(approval.approval_key, 'approve')} className="rounded-[8px] border-none bg-amber px-2.5 py-1.5 text-[11px] font-bold text-white cursor-pointer">Approve & Send</button></div>)}
              <div className="divide-y divide-border-color">{notifications.length === 0 ? <div className="p-8 text-center text-[12px] text-muted">No notifications for this filter.</div> : notifications.map((notification) => <div key={notification.id} className={`p-4 flex gap-3 ${notification.is_read ? 'bg-panel' : 'bg-teal-tint/25'}`}><span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${notification.is_read ? 'bg-[#C7CEDB]' : notification.category === 'human_intervention' ? 'bg-amber' : 'bg-teal'}`} /><div className="flex-1"><div className={`text-[13px] text-ink ${notification.is_read ? 'font-medium' : 'font-bold'}`}>{notification.title}</div><div className="mt-1 text-[11.5px] text-muted">{notification.message}</div><div className="mt-1.5 text-[10px] text-faint">{new Date(notification.created_at).toLocaleString()}</div></div><span className="text-[10px] font-bold uppercase tracking-wide text-muted">{notification.category.replace('_', ' ')}</span></div>)}</div>
            </div>
          )}
          
        </motion.div>
      </AnimatePresence>
      {viewSite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0F19]/50 p-4">
          <div className="w-full max-w-2xl rounded-[16px] border border-border-color bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.5px] text-muted font-bold">Site Detail</div>
                <h3 className="mt-1 text-[24px] font-head font-extrabold text-ink">{viewSite.name}</h3>
              </div>
              <button type="button" onClick={() => setViewSite(null)} className="rounded-[8px] border border-border-color bg-white px-3 py-2 text-[12px] font-bold text-ink cursor-pointer">Close</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[12.5px]">
              <div className="rounded-[10px] bg-panel p-3 border border-border-color">
                <div className="text-faint uppercase tracking-[0.5px] text-[10px] font-bold mb-1">Location</div>
                <div className="text-ink font-semibold">{viewSite.location || '—'}</div>
              </div>
              <div className="rounded-[10px] bg-panel p-3 border border-border-color">
                <div className="text-faint uppercase tracking-[0.5px] text-[10px] font-bold mb-1">Status</div>
                <div className="text-ink font-semibold">{viewSite.normalizedStatus || 'Active'}</div>
              </div>
              <div className="rounded-[10px] bg-panel p-3 border border-border-color">
                <div className="text-faint uppercase tracking-[0.5px] text-[10px] font-bold mb-1">Live Modules</div>
                <div className="text-ink font-semibold">{viewSite.normalizedModules ?? 0}</div>
              </div>
              <div className="rounded-[10px] bg-panel p-3 border border-border-color">
                <div className="text-faint uppercase tracking-[0.5px] text-[10px] font-bold mb-1">Agents</div>
                <div className="text-ink font-semibold">{viewSite.normalizedAgents ?? 0}</div>
              </div>
            </div>

            <div className="mt-4 rounded-[10px] bg-panel p-3 border border-border-color">
              <div className="text-faint uppercase tracking-[0.5px] text-[10px] font-bold mb-2">Description</div>
              <div className="text-[12.5px] text-ink leading-relaxed">{viewSite.description || 'No description provided for this site.'}</div>
            </div>

            <div className="mt-4 rounded-[10px] bg-panel p-3 border border-border-color">
              <div className="text-faint uppercase tracking-[0.5px] text-[10px] font-bold mb-2">System Logs</div>
              <ul className="space-y-2 text-[12px] text-muted">
                <li>• Connectivity mapped to {viewSite.normalizedConnectivity || 'Pending'}.</li>
                <li>• Module count is auto-mapped from the live plant telemetry feed.</li>
                <li>• Agent count is reserved for downstream assignment synchronization.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {editSite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0F19]/50 p-4">
          <div className="w-full max-w-xl rounded-[16px] border border-border-color bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.5px] text-muted font-bold">Update Site</div>
                <h3 className="mt-1 text-[24px] font-head font-extrabold text-ink">{editSite.name}</h3>
              </div>
              <button type="button" onClick={() => setEditSite(null)} className="rounded-[8px] border border-border-color bg-white px-3 py-2 text-[12px] font-bold text-ink cursor-pointer">Cancel</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.5px] text-faint">Site / Plant Name</label>
                <input value={editSite.name || ''} onChange={(e) => setEditSite({ ...editSite, name: e.target.value })} className="w-full rounded-[10px] border border-border-color bg-white px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-teal" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.5px] text-faint">Location</label>
                <input value={editSite.location || ''} onChange={(e) => setEditSite({ ...editSite, location: e.target.value })} className="w-full rounded-[10px] border border-border-color bg-white px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-teal" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.5px] text-faint">Description</label>
                <textarea value={editSite.description || ''} onChange={(e) => setEditSite({ ...editSite, description: e.target.value })} rows={4} className="w-full rounded-[10px] border border-border-color bg-white px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-teal" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.5px] text-faint">Status</label>
                <select value={editSite.status || 'Active'} onChange={(e) => setEditSite({ ...editSite, status: e.target.value })} className="w-full rounded-[10px] border border-border-color bg-white px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-teal">
                  <option value="Active">Active</option>
                  <option value="Live">Live</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setEditSite(null)} className="rounded-[10px] border border-border-color bg-white px-4 py-2 text-[12px] font-bold text-ink cursor-pointer">Cancel</button>
              <button type="button" onClick={() => void handleSiteUpdate(editSite)} className="rounded-[10px] bg-teal px-4 py-2 text-[12px] font-bold text-white cursor-pointer">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {deleteSiteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0F19]/50 p-4">
          <div className="w-full max-w-md rounded-[16px] border border-border-color bg-white p-5 shadow-xl">
            <div className="text-[11px] uppercase tracking-[0.5px] text-muted font-bold">Delete Site</div>
            <h3 className="mt-1 text-[24px] font-head font-extrabold text-ink">Confirm deletion</h3>
            <p className="mt-3 text-[13px] text-muted">
              Deactivate or delete {siteRows.find((site) => site.id === deleteSiteId)?.name || 'this plant'}? This action will remove the site record from the admin catalog.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setDeleteSiteId(null)} className="rounded-[10px] border border-border-color bg-white px-4 py-2 text-[12px] font-bold text-ink cursor-pointer">Cancel</button>
              <button type="button" onClick={() => void handleSiteDelete(deleteSiteId)} className="rounded-[10px] bg-red-600 px-4 py-2 text-[12px] font-bold text-white cursor-pointer">Delete</button>
            </div>
          </div>
        </div>
      )}

      {showHitlModal && (
        <HITLSettingsModal onClose={() => setShowHitlModal(false)} onUpdated={() => { void useStore().fetchGovernanceSettings(); }} />
      )}
    </motion.div>
  );
};
