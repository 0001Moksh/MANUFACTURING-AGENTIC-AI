import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { UsersTable } from '../components/admin/UsersTable';
import { ConnectorsGrid } from '../components/admin/ConnectorsGrid';
import { RulesBuilder } from '../components/admin/RulesBuilder';
import { useStore } from '../store';
import { guardrails } from '../data/mockData';
import { api } from '../services/api';

export const AdminConsolePage: React.FC = () => {
  const location = useLocation();
  const { explainableLogs, humanInLoop, toggleGovernanceSetting } = useStore();
  const [activePane, setActivePane] = useState(() => new URLSearchParams(location.search).get('pane') === 'notifications' ? 'notifications' : 'users');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [notificationFilter, setNotificationFilter] = useState('all');

  useEffect(() => {
    if (new URLSearchParams(location.search).get('pane') === 'notifications') setActivePane('notifications');
  }, [location.search]);

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
            onClick={() => setActivePane(p.id)}
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
          {activePane === 'users' && (
            <div>
              <UsersTable />
              <div className="flex flex-col gap-[10px] mt-[14px]">
                <div className="flex items-center gap-[14px] bg-panel border border-border-color rounded-[11px] p-[13px_16px]">
                  <div className="flex-1">
                    <div className="font-bold text-[13px] mb-[2px]">SSO / SAML & Active Directory</div>
                    <div className="text-[11.5px] text-muted">Group-based role mapping — no manual user provisioning per plant</div>
                  </div>
                  <span className="text-[10.5px] font-bold py-[3px] px-[9px] rounded-[20px] bg-blue-tint text-[#2258b0]">Configured</span>
                </div>
                <div className="flex items-center gap-[14px] bg-panel border border-border-color rounded-[11px] p-[13px_16px]">
                  <div className="flex-1">
                    <div className="font-bold text-[13px] mb-[2px]">Granular RBAC</div>
                    <div className="text-[11.5px] text-muted">Permissions scoped to module, plant and even individual agent — not all-or-nothing</div>
                  </div>
                  <span className="text-[10.5px] font-bold py-[3px] px-[9px] rounded-[20px] bg-blue-tint text-[#2258b0]">Enabled</span>
                </div>
              </div>
            </div>
          )}

          {activePane === 'sites' && (
            <div className="bg-panel border border-border-color rounded-[14px] overflow-hidden">
              <table className="w-full border-collapse text-[12.5px]">
                <thead>
                  <tr>
                    <th className="text-left text-[10.5px] uppercase tracking-[0.5px] text-faint p-[9px_14px] border-b border-border-color font-bold">Plant / Site</th>
                    <th className="text-left text-[10.5px] uppercase tracking-[0.5px] text-faint p-[9px_14px] border-b border-border-color font-bold">Location</th>
                    <th className="text-left text-[10.5px] uppercase tracking-[0.5px] text-faint p-[9px_14px] border-b border-border-color font-bold">Modules Live</th>
                    <th className="text-left text-[10.5px] uppercase tracking-[0.5px] text-faint p-[9px_14px] border-b border-border-color font-bold">Agents</th>
                    <th className="text-left text-[10.5px] uppercase tracking-[0.5px] text-faint p-[9px_14px] border-b border-border-color font-bold">Connectivity</th>
                    <th className="text-left text-[10.5px] uppercase tracking-[0.5px] text-faint p-[9px_14px] border-b border-border-color font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Alpha Refinery', 'UAE', '12 / 12', '12', 'Edge + Cloud', 'Live'],
                    ['Beta Offshore Platform', 'UAE', '8 / 12', '8', 'Edge-only (offline-capable)', 'Live'],
                    ['Gamma Gas Processing', 'India', '10 / 12', '10', 'Edge + Cloud', 'Live'],
                    ['Delta Plant', 'India', '12 / 12', '12', 'Edge + Cloud', 'Live'],
                    ['Epsilon Onshore', 'Canada', '6 / 12', '6', 'Edge + Cloud', 'Pilot'],
                    ['Zeta Terminal', 'UAE', '4 / 12', '4', 'Edge + Cloud', 'Onboarding'],
                  ].map((row, idx) => (
                    <tr key={idx} className="border-b border-[#F0F2F7] last:border-b-0">
                      <td className="p-[12px_14px] font-bold align-middle">{row[0]}</td>
                      <td className="p-[12px_14px] align-middle">{row[1]}</td>
                      <td className="p-[12px_14px] align-middle">{row[2]}</td>
                      <td className="p-[12px_14px] align-middle">{row[3]}</td>
                      <td className="p-[12px_14px] align-middle">{row[4]}</td>
                      <td className="p-[12px_14px] align-middle">
                        <span className={`text-[10.5px] font-bold py-[3px] px-[9px] rounded-[20px] ${
                          row[5] === 'Live' ? 'bg-green-tint text-green' : row[5] === 'Pilot' ? 'bg-amber-tint text-[#9A6400]' : 'bg-[#EEF0F5] text-muted'
                        }`}>
                          {row[5]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activePane === 'integrations' && <ConnectorsGrid />}
          
          {activePane === 'guardrails' && (
            <div className="flex flex-col gap-[10px]">
              {/* ── Functional DB-backed toggles ── */}
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
              ))}

              {/* ── Static read-only guardrails ── */}
              {guardrails
                .filter(g => g[0] !== 'Explainability logging' && g[0] !== 'Human-in-the-loop approval for high-risk actions')
                .map((g, i) => (
                  <div key={i} className="flex items-center gap-[14px] bg-panel border border-border-color rounded-[11px] p-[13px_16px]">
                    <div className="flex-1">
                      <div className="font-bold text-[13px] mb-[2px]">{g[0]}</div>
                      <div className="text-[11.5px] text-muted">{g[1]}</div>
                    </div>
                    <span className={`text-[10.5px] font-bold py-[3px] px-[9px] rounded-[20px] ${
                      g[2] === 'On' ? 'bg-green-tint text-green' : g[2] === 'Configurable' ? 'bg-blue-tint text-[#2258b0]' : 'bg-amber-tint text-[#9A6400]'
                    }`}>
                      {g[2]}
                    </span>
                  </div>
                ))}
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
    </motion.div>
  );
};
