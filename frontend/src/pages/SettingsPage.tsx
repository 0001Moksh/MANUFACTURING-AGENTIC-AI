import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { LockKeyhole, MailCheck, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';

export const SettingsPage: React.FC = () => {
  const [profile, setProfile] = useState({ name: '', email: '', email_verified: false, role: '', site: '' });
  const [verificationCode, setVerificationCode] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => { void api.get('/profile').then((response) => setProfile(response.data)).catch(() => setNotice('Profile could not be loaded.')); }, []);
  const saveName = async () => { await api.patch('/profile', { name: profile.name }); setNotice('Name saved.'); };
  const requestEmailVerification = async () => { await api.post('/profile/email/request-verification', { email: profile.email }); setNotice('Verification code sent to the new email address.'); };
  const verifyEmail = async () => { const response = await api.post('/profile/email/verify', { code: verificationCode }); setProfile((value) => ({ ...value, email: response.data.email, email_verified: true })); setNotice('Email verified.'); };
  const requestPasswordReset = async () => { await api.post('/profile/password/request-reset'); setNotice('Password reset code sent to your verified email.'); };
  const confirmPasswordReset = async () => { await api.post('/profile/password/confirm-reset', { code: resetCode, password: newPassword }); setResetCode(''); setNewPassword(''); setNotice('Password updated.'); };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-6"

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

      <section className="mb-6 max-w-[820px] bg-panel border border-border-color rounded-[14px] p-5">
        <div className="flex items-center gap-2 mb-4"><ShieldCheck className="w-5 h-5 text-teal" /><div><h3 className="m-0 font-head text-[16px] font-bold text-ink">User Profile</h3><p className="m-0 mt-0.5 text-[11.5px] text-muted">Your verified email is the source of truth for approval notifications.</p></div></div>
        {notice && <div className="mb-3 rounded-lg bg-teal-tint border border-teal/20 px-3 py-2 text-[11.5px] text-teal-deep">{notice}</div>}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-[11px] font-bold uppercase tracking-wide text-muted">Name<input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} className="mt-1.5 w-full rounded-[9px] border border-border-color px-3 py-2 text-[13px] font-normal text-ink outline-none focus:border-teal" /></label>
          <label className="text-[11px] font-bold uppercase tracking-wide text-muted">Role<input value={profile.role} disabled className="mt-1.5 w-full rounded-[9px] border border-border-color bg-canvas px-3 py-2 text-[13px] font-normal text-muted cursor-not-allowed" /></label>
        </div>
        <div className="mt-3 flex items-end gap-2 flex-wrap"><label className="text-[11px] font-bold uppercase tracking-wide text-muted flex-1 min-w-[220px]">Email<input type="email" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} className="mt-1.5 w-full rounded-[9px] border border-border-color px-3 py-2 text-[13px] font-normal text-ink outline-none focus:border-teal" /></label><button onClick={() => void requestEmailVerification()} className="rounded-[9px] bg-navy-900 px-3 py-2 text-[12px] font-bold text-white border-none cursor-pointer">Verify email</button><button onClick={() => void saveName()} className="rounded-[9px] border border-border-color bg-panel px-3 py-2 text-[12px] font-bold text-ink cursor-pointer">Save name</button></div>
        <div className="mt-2 text-[11px] text-muted">{profile.email_verified ? 'Verified email' : 'Email is not verified — it cannot receive approval requests.'}</div>
        {!profile.email_verified && <div className="mt-3 flex gap-2"><input value={verificationCode} onChange={(event) => setVerificationCode(event.target.value)} placeholder="6-digit verification code" className="flex-1 rounded-[9px] border border-border-color px-3 py-2 text-[12px] outline-none focus:border-teal" /><button onClick={() => void verifyEmail()} className="rounded-[9px] border border-teal/30 bg-teal-tint px-3 py-2 text-[12px] font-bold text-teal-deep cursor-pointer"><MailCheck className="w-3.5 h-3.5 inline mr-1" />Confirm</button></div>}
        <div className="mt-5 pt-4 border-t border-border-color"><div className="flex items-center justify-between gap-3"><div><div className="text-[13px] font-bold text-ink"><LockKeyhole className="w-3.5 h-3.5 inline mr-1.5" />Security</div><div className="text-[11.5px] text-muted">Password changes require a time-limited code sent to your verified email.</div></div><button onClick={() => void requestPasswordReset()} disabled={!profile.email_verified} className="rounded-[9px] bg-navy-900 px-3 py-2 text-[12px] font-bold text-white border-none cursor-pointer disabled:opacity-50">Reset Password</button></div><div className="mt-3 grid gap-2 sm:grid-cols-2"><input value={resetCode} onChange={(event) => setResetCode(event.target.value)} placeholder="Reset code" className="rounded-[9px] border border-border-color px-3 py-2 text-[12px] outline-none focus:border-teal" /><input value={newPassword} onChange={(event) => setNewPassword(event.target.value)} type="password" placeholder="New password (12+ characters)" className="rounded-[9px] border border-border-color px-3 py-2 text-[12px] outline-none focus:border-teal" /></div><button onClick={() => void confirmPasswordReset()} disabled={!resetCode || newPassword.length < 12} className="mt-2 rounded-[9px] border border-border-color bg-panel px-3 py-2 text-[12px] font-bold text-ink cursor-pointer disabled:opacity-50">Update Password</button></div>
      </section>

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
