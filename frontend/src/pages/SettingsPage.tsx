import React from 'react';
import { motion } from 'framer-motion';

export const SettingsPage: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mb-[20px]">
        <div className="text-[11px] font-bold tracking-[1.2px] text-teal-deep uppercase mb-[6px]">
          Platform Settings
        </div>
        <h2 className="font-head text-[24px] m-[0_0_6px] font-extrabold text-ink">
          Enterprise-grade, white-labelled, yours to control
        </h2>
        <p className="m-0 text-muted text-[13.5px] max-w-[720px] leading-relaxed">
          The details Digital Heads ask about in the second meeting.
        </p>
      </div>

      <div className="flex flex-col gap-[10px]">
        <div className="flex items-center gap-[14px] bg-panel border border-border-color rounded-[11px] p-[13px_16px]">
          <div className="flex-1">
            <div className="font-bold text-[13px] mb-[2px]">White-label branding</div>
            <div className="text-[11.5px] text-muted">Your logo, colours and domain across web & mobile app</div>
          </div>
          <span className="text-[10.5px] font-bold py-[3px] px-[9px] rounded-[20px] bg-blue-tint text-[#2258b0]">Configurable</span>
        </div>

        <div className="flex items-center gap-[14px] bg-panel border border-border-color rounded-[11px] p-[13px_16px]">
          <div className="flex-1">
            <div className="font-bold text-[13px] mb-[2px]">SSO / SAML / Azure AD</div>
            <div className="text-[11.5px] text-muted">Single sign-on across all plants and roles</div>
          </div>
          <span className="text-[10.5px] font-bold py-[3px] px-[9px] rounded-[20px] bg-green-tint text-green">Enabled</span>
        </div>

        <div className="flex items-center gap-[14px] bg-panel border border-border-color rounded-[11px] p-[13px_16px]">
          <div className="flex-1">
            <div className="font-bold text-[13px] mb-[2px]">API keys & webhooks</div>
            <div className="text-[11.5px] text-muted">Programmatic access to every module for your own tooling</div>
          </div>
          <span className="text-[10.5px] font-bold py-[3px] px-[9px] rounded-[20px] bg-green-tint text-green">3 active keys</span>
        </div>

        <div className="flex items-center gap-[14px] bg-panel border border-border-color rounded-[11px] p-[13px_16px]">
          <div className="flex-1">
            <div className="font-bold text-[13px] mb-[2px]">Data retention</div>
            <div className="text-[11.5px] text-muted">Time-series, video and audit data retention window, per site</div>
          </div>
          <span className="text-[10.5px] font-bold py-[3px] px-[9px] rounded-[20px] bg-blue-tint text-[#2258b0]">365 days</span>
        </div>

        <div className="flex items-center gap-[14px] bg-panel border border-border-color rounded-[11px] p-[13px_16px]">
          <div className="flex-1">
            <div className="font-bold text-[13px] mb-[2px]">Environment</div>
            <div className="text-[11.5px] text-muted">Sandbox → Staging → Production promotion path</div>
          </div>
          <span className="text-[10.5px] font-bold py-[3px] px-[9px] rounded-[20px] bg-amber-tint text-[#9A6400]">Sandbox (this demo)</span>
        </div>
      </div>
    </motion.div>
  );
};
