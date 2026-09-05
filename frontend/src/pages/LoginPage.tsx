import React, { useState } from 'react';
import { Shield, LogIn, RefreshCw, AlertCircle } from 'lucide-react';
import { authService } from '../services/api';
import { useStore } from '../store';

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('Admin@123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useStore();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = await authService.login(username, password);
      login(data.access_token, data.role, data.site, username);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid username or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B0F19] text-[#FAFBFE] p-4 relative overflow-hidden font-sans">
      {/* Background logo watermark & gradients */}
      <img src="/logo-bg.png" alt="" className="absolute inset-0 w-full h-full object-cover opacity-10 pointer-events-none filter blur-xs" />
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-teal-tint/10 blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-purple-tint/5 blur-[120px]" />

      <div className="w-full max-w-[420px] bg-[#111625]/90 border border-border-color/30 rounded-[18px] p-8 shadow-2xl backdrop-blur-md relative z-10">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-[64px] h-[64px] rounded-[16px] bg-white/10 p-2 flex items-center justify-center mb-4 border border-white/20 shadow-lg">
            <img src="/logo.png" alt="IIIoT Logo" className="w-full h-full object-contain" />
          </div>
          <h2 className="font-head text-[22px] font-extrabold m-0 tracking-tight">Manufacturing Agentic AI</h2>
          <p className="text-[12.5px] text-muted mt-1.5 leading-relaxed">Enterprise IIIoT &amp; MES Orchestration Console</p>
        </div>

        {error && (
          <div className="bg-red-tint border border-red/40 text-red rounded-[9px] p-3 flex gap-2 items-start mb-5 text-[12px] leading-relaxed">
            <AlertCircle className="w-[16px] h-[16px] shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11.5px] font-bold text-muted uppercase tracking-wider">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={loading}
              className="bg-[#171D2F] border border-border-color/40 rounded-[9px] p-3 text-[13px] text-[#FAFBFE] focus:outline-none focus:border-teal/50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11.5px] font-bold text-muted uppercase tracking-wider">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              className="bg-[#171D2F] border border-border-color/40 rounded-[9px] p-3 text-[13px] text-[#FAFBFE] focus:outline-none focus:border-teal/50"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-teal text-white border-none rounded-[9px] p-3.5 text-[13px] font-bold cursor-pointer hover:bg-teal-deep transition-all mt-3 flex items-center justify-center gap-2 shadow-lg shadow-teal/10"
          >
            {loading ? <RefreshCw className="animate-spin w-[16px] h-[16px]" /> : <LogIn className="w-[16px] h-[16px]" />}
            Login to Command Center
          </button>
        </form>

        <div className="mt-8 border-t border-border-color/20 pt-4 text-center">
          <div className="inline-flex items-center gap-1.5 text-[10.5px] text-muted bg-[#161D2E] p-[4px_10px] rounded-[20px] border border-border-color/30">
            <Shield className="w-[12px] h-[12px] text-teal" />
            <span>Default: <b>admin</b> / <b>Admin@123</b></span>
          </div>
        </div>
      </div>
    </div>
  );
};
