import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  LockKeyhole,
  MailCheck,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Palette,
  Key,
  Database,
  Layers,
  User,
} from 'lucide-react';
import { api } from '../services/api';

export const SettingsPage: React.FC = () => {
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    email_verified: false,
    role: '',
    site: '',
  });
  const [verificationCode, setVerificationCode] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [passwordResetNotice, setPasswordResetNotice] = useState('');

  useEffect(() => {
    void api
      .get('/profile')
      .then((response) => setProfile(response.data))
      .catch(() => setNotice('Profile could not be loaded.'));
  }, []);

  const saveName = async () => {
    await api.patch('/profile', { name: profile.name });
    setNotice('Name saved successfully.');
  };

  const requestEmailVerification = async () => {
    await api.post('/profile/email/request-verification', { email: profile.email });
    setNotice('Verification code sent to the new email address.');
  };

  const verifyEmail = async () => {
    const response = await api.post('/profile/email/verify', { code: verificationCode });
    setProfile((value) => ({
      ...value,
      email: response.data.email,
      email_verified: true,
    }));
    setVerificationCode('');
    setNotice('Email verified successfully.');
  };

  const requestPasswordReset = async () => {
    await api.post('/profile/password/request-reset');
    setShowPasswordReset(true);
    setPasswordResetNotice('Password reset code sent to your verified email.');
    setNotice('Password reset code sent to your verified email.');
  };

  const confirmPasswordReset = async () => {
    await api.post('/profile/password/confirm-reset', {
      code: resetCode,
      password: newPassword,
    });
    setResetCode('');
    setNewPassword('');
    setShowPasswordReset(false);
    setPasswordResetNotice('');
    setNotice('Password updated successfully.');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="p-6 md:p-10 max-w-[980px]"
    >
      {/* Page Header */}
      <div className="mb-10">
        <h1 className="font-head text-[28px] m-0 mb-2 font-extrabold text-ink tracking-tight">
          Enterprise-grade, white-labelled, yours to control
        </h1>
        <p className="m-0 text-muted text-[14.5px] max-w-[640px] leading-relaxed">
          The details Digital Heads ask about in the second meeting.
        </p>
      </div>

      {/* ===================== PROFILE + SECURITY ===================== */}
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] mb-10">
        
        {/* -------- LEFT: Profile -------- */}
        <section className="bg-panel border border-border-color rounded-2xl p-6 md:p-7 shadow-sm">
          <div className="flex items-center gap-3 mb-7">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal/10 text-teal">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="m-0 font-head text-[18px] font-bold text-ink">
                {profile.role ? `${profile.role}'s Profile` : 'User Profile'}
              </h2>
              <p className="m-0 mt-0.5 text-[12.5px] text-muted">
                Manage your identity & contact details
              </p>
            </div>
          </div>
          {/* Name */}
          <div className="mb-5">
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                Full Name
              </span>
              <div className="mt-2 flex gap-2.5">
                <input
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className="flex-1 rounded-xl border border-border-color bg-canvas px-4 py-2.5 text-[14px] text-ink outline-none transition focus:border-teal focus:ring-2 focus:ring-teal/15"
                  placeholder="Enter your name"
                />
                <button
                  onClick={() => void saveName()}
                  className="rounded-xl bg-navy-900 px-5 py-2.5 text-[13px] font-bold text-white border-none cursor-pointer transition hover:opacity-90 active:scale-[0.98] whitespace-nowrap"
                >
                  Save
                </button>
              </div>
            </label>
          </div>

          {/* Email */}
          <div className="mb-4">
            <label className="block">
              <div className="flex items-center gap-2.5 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  Email Address
                </span>
                {profile.email_verified ? (
                  <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2.5 py-0.5 rounded-full bg-teal-tint text-teal-deep border border-teal/20">
                    <CheckCircle2 className="w-3 h-3" />
                    Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2.5 py-0.5 rounded-full bg-amber-tint text-[#9A6400] border border-amber-500/20">
                    <AlertCircle className="w-3 h-3" />
                    Not verified
                  </span>
                )}
              </div>

              <div className="flex gap-2.5">
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  className="flex-1 rounded-xl border border-border-color bg-canvas px-4 py-2.5 text-[14px] text-ink outline-none transition focus:border-teal focus:ring-2 focus:ring-teal/15"
                  placeholder="name@company.com"
                />
                <button
                  onClick={() => void requestEmailVerification()}
                  className="rounded-xl bg-navy-900 px-5 py-2.5 text-[13px] font-bold text-white border-none cursor-pointer transition hover:opacity-90 active:scale-[0.98] whitespace-nowrap"
                >
                  Verify
                </button>
              </div>
            </label>
          </div>

          {/* Verification Code */}
          {!profile.email_verified && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-4 pt-4 border-t border-border-color"
            >
              <p className="m-0 mb-3 text-[12.5px] text-muted">
                Enter the 6-digit code sent to your email
              </p>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="6-digit code"
                  className="flex-1 rounded-xl border border-border-color bg-canvas px-4 py-2.5 text-[14px] outline-none transition focus:border-teal focus:ring-2 focus:ring-teal/15"
                />
                <button
                  onClick={() => void verifyEmail()}
                  className="rounded-xl border border-teal/30 bg-teal-tint px-5 py-2.5 text-[13px] font-bold text-teal-deep cursor-pointer transition hover:bg-teal/10 active:scale-[0.98] flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <MailCheck className="w-4 h-4" />
                  Confirm
                </button>
              </div>
            </motion.div>
          )}
        </section>

        {/* -------- RIGHT: Security -------- */}
        <section className="bg-panel border border-border-color rounded-2xl p-6 md:p-7 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-900/8 text-navy-900">
              <LockKeyhole className="w-5 h-5" />
            </div>
            <div>
              <h2 className="m-0 font-head text-[18px] font-bold text-ink">Security</h2>
              <p className="m-0 mt-0.5 text-[12.5px] text-muted">
                Password & account protection
              </p>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-between">
            <div>
              <button
                onClick={() => void requestPasswordReset()}
                disabled={!profile.email_verified}
                className="w-full rounded-xl bg-navy-900 px-5 py-3 text-[13.5px] font-bold text-white border-none cursor-pointer transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                Reset Password
              </button>
            </div>

            {/* Password Reset Notice + Fields */}
            {showPasswordReset && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 pt-6 border-t border-border-color"
              >
                {/* Notice inside Security section */}
                {passwordResetNotice && (
                  <div className="mb-4 flex items-center gap-2.5 rounded-xl bg-teal-tint border border-teal/20 px-4 py-3 text-[13px] text-teal-deep">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    {passwordResetNotice}
                  </div>
                )}

                <div className="flex items-center gap-2 mb-4">
                  <KeyRound className="w-4 h-4 text-navy-900" />
                  <span className="text-[13px] font-semibold text-ink">
                    Enter reset details
                  </span>
                </div>

                <div className="space-y-3 mb-4">
                  <input
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    placeholder="Reset code"
                    className="w-full rounded-xl border border-border-color bg-canvas px-4 py-2.5 text-[14px] outline-none transition focus:border-teal focus:ring-2 focus:ring-teal/15"
                  />
                  <input
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    type="password"
                    placeholder="New password (12+ characters)"
                    className="w-full rounded-xl border border-border-color bg-canvas px-4 py-2.5 text-[14px] outline-none transition focus:border-teal focus:ring-2 focus:ring-teal/15"
                  />
                </div>

                <button
                  onClick={() => void confirmPasswordReset()}
                  disabled={!resetCode || newPassword.length < 12}
                  className="w-full rounded-xl border border-border-color bg-canvas px-5 py-2.5 text-[13px] font-bold text-ink cursor-pointer transition hover:bg-panel disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
                >
                  Update Password
                </button>
              </motion.div>
            )}
          </div>
        </section>
      </div>

      {/* ===================== ENTERPRISE FEATURES ===================== */}
      <div>
        <h3 className="m-0 mb-4 font-head text-[15px] font-bold text-ink uppercase tracking-wider">
          Platform Capabilities
        </h3>

        <div className="grid gap-3 sm:grid-cols-2">
          {[
            {
              icon: <Palette className="w-4.5 h-4.5" />,
              title: 'White-label branding',
              desc: 'Your logo, colours and domain across web & mobile',
              badge: 'Configurable',
              badgeClass: 'bg-blue-tint text-[#2258b0]',
            },
            {
              icon: <Key className="w-4.5 h-4.5" />,
              title: 'SSO / SAML / Azure AD',
              desc: 'Single sign-on across all plants and roles',
              badge: 'Enabled',
              badgeClass: 'bg-green-tint text-green',
            },
            {
              icon: <KeyRound className="w-4.5 h-4.5" />,
              title: 'API keys & webhooks',
              desc: 'Programmatic access to every module',
              badge: '3 active keys',
              badgeClass: 'bg-green-tint text-green',
            },
            {
              icon: <Database className="w-4.5 h-4.5" />,
              title: 'Data retention',
              desc: 'Time-series, video and audit data per site',
              badge: '365 days',
              badgeClass: 'bg-blue-tint text-[#2258b0]',
            },
            {
              icon: <Layers className="w-4.5 h-4.5" />,
              title: 'Environment',
              desc: 'Sandbox → Staging → Production path',
              badge: 'Sandbox',
              badgeClass: 'bg-amber-tint text-[#9A6400]',
            },
          ].map((item) => (
            <div
              key={item.title}
              className="flex items-start gap-4 bg-panel border border-border-color rounded-xl p-4 transition hover:border-teal/30 hover:shadow-sm"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-canvas text-muted">
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="font-bold text-[13.5px] text-ink">{item.title}</span>
                  <span className={`shrink-0 text-[10.5px] font-bold py-0.5 px-2.5 rounded-full ${item.badgeClass}`}>
                    {item.badge}
                  </span>
                </div>
                <p className="m-0 text-[12.5px] text-muted leading-snug">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};