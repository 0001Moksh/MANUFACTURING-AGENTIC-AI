import React from 'react';

export const UsersTable: React.FC = () => {
  return (
    <div className="bg-panel border border-border-color rounded-[14px] overflow-hidden">
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr>
            <th className="text-left text-[10.5px] uppercase tracking-[0.5px] text-faint p-[9px_14px] border-b border-border-color font-bold">Role</th>
            <th className="text-left text-[10.5px] uppercase tracking-[0.5px] text-faint p-[9px_14px] border-b border-border-color font-bold">Access Scope</th>
            <th className="text-left text-[10.5px] uppercase tracking-[0.5px] text-faint p-[9px_14px] border-b border-border-color font-bold">Permissions</th>
            <th className="text-left text-[10.5px] uppercase tracking-[0.5px] text-faint p-[9px_14px] border-b border-border-color font-bold">Users</th>
            <th className="text-left text-[10.5px] uppercase tracking-[0.5px] text-faint p-[9px_14px] border-b border-border-color font-bold"></th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-[#F0F2F7] last:border-b-0">
            <td className="p-[12px_14px] align-middle">
              <b className="font-bold">Super Admin</b><br />
              <span className="text-muted text-[11.5px]">IIIoT Platform Team</span>
            </td>
            <td className="p-[12px_14px] align-middle">All sites</td>
            <td className="p-[12px_14px] align-middle">Full config · model governance · billing</td>
            <td className="p-[12px_14px] align-middle">2</td>
            <td className="p-[12px_14px] align-middle">
              <span className="text-[10.5px] font-bold py-[3px] px-[9px] rounded-[20px] bg-blue-tint text-[#2258b0]">SSO enforced</span>
            </td>
          </tr>
          <tr className="border-b border-[#F0F2F7] last:border-b-0">
            <td className="p-[12px_14px] align-middle"><b className="font-bold">Plant Digital Head</b></td>
            <td className="p-[12px_14px] align-middle">Assigned plant(s)</td>
            <td className="p-[12px_14px] align-middle">Configure agents, integrations, alert rules</td>
            <td className="p-[12px_14px] align-middle">6</td>
            <td className="p-[12px_14px] align-middle">
              <span className="text-[10.5px] font-bold py-[3px] px-[9px] rounded-[20px] bg-green-tint text-green">Active</span>
            </td>
          </tr>
          <tr className="border-b border-[#F0F2F7] last:border-b-0">
            <td className="p-[12px_14px] align-middle"><b className="font-bold">Operations / Plant Head</b></td>
            <td className="p-[12px_14px] align-middle">Assigned plant(s)</td>
            <td className="p-[12px_14px] align-middle">View dashboards, approve escalations</td>
            <td className="p-[12px_14px] align-middle">14</td>
            <td className="p-[12px_14px] align-middle">
              <span className="text-[10.5px] font-bold py-[3px] px-[9px] rounded-[20px] bg-green-tint text-green">Active</span>
            </td>
          </tr>
          <tr className="border-b border-[#F0F2F7] last:border-b-0">
            <td className="p-[12px_14px] align-middle"><b className="font-bold">HSE Officer</b></td>
            <td className="p-[12px_14px] align-middle">Assigned plant(s)</td>
            <td className="p-[12px_14px] align-middle">Manage safety agents, permits, incidents</td>
            <td className="p-[12px_14px] align-middle">9</td>
            <td className="p-[12px_14px] align-middle">
              <span className="text-[10.5px] font-bold py-[3px] px-[9px] rounded-[20px] bg-green-tint text-green">Active</span>
            </td>
          </tr>
          <tr className="border-b border-[#F0F2F7] last:border-b-0">
            <td className="p-[12px_14px] align-middle"><b className="font-bold">Shift Supervisor</b></td>
            <td className="p-[12px_14px] align-middle">Assigned zone(s)</td>
            <td className="p-[12px_14px] align-middle">Acknowledge & action floor alerts</td>
            <td className="p-[12px_14px] align-middle">42</td>
            <td className="p-[12px_14px] align-middle">
              <span className="text-[10.5px] font-bold py-[3px] px-[9px] rounded-[20px] bg-green-tint text-green">Active</span>
            </td>
          </tr>
          <tr className="border-b border-[#F0F2F7] last:border-b-0">
            <td className="p-[12px_14px] align-middle"><b className="font-bold">Viewer / Auditor</b></td>
            <td className="p-[12px_14px] align-middle">All / assigned sites</td>
            <td className="p-[12px_14px] align-middle">Read-only, export reports</td>
            <td className="p-[12px_14px] align-middle">11</td>
            <td className="p-[12px_14px] align-middle">
              <span className="text-[10.5px] font-bold py-[3px] px-[9px] rounded-[20px] bg-[#EEF0F5] text-muted">Read-only</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};
