import React, { useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, FileUp, ShieldCheck, UploadCloud } from 'lucide-react';
import { licenseService } from '../services/api';

interface LicenseGatePageProps {
  onVerified: () => void;
}

export const LicenseGatePage: React.FC<LicenseGatePageProps> = ({ onVerified }) => {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState('Waiting for license...');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onFileSelected = (nextFile: File | null) => {
    setFile(nextFile);
    if (nextFile) {
      setStatus('License file selected');
      setMessage(nextFile.name);
    }
  };

  const handleVerify = async () => {
    if (!file) {
      setStatus('No file selected');
      setMessage('Please upload a valid .lic file to continue.');
      return;
    }

    setLoading(true);
    setStatus('Verifying license...');
    setMessage('');

    try {
      const response = await licenseService.verify(file);
      if (response?.is_valid) {
        setStatus('✓ License Verified');
        setMessage(`Customer: ${response.customer_name || 'Unknown'}\nLicense: ${response.license_type || 'Annual'}`);
        onVerified();
        return;
      }

      setStatus('✕ License Validation Failed');
      setMessage(response?.message || 'The supplied license is invalid or has been modified.');
    } catch (error: any) {
      const detail = error?.response?.data?.message || error?.response?.data?.detail || 'The supplied license is invalid or has been modified.';
      setStatus('✕ License Validation Failed');
      setMessage(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-white flex items-center justify-center p-4" >
      <div className="w-full max-w-[560px] bg-[#111625]/90 border border-border-color/30 rounded-[18px] p-6 md:p-8 shadow-2xl backdrop-blur-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-teal/10 border border-teal/30 mb-4">
            <ShieldCheck className="h-8 w-8 text-teal" />
          </div>
          <h1 className="font-head text-[28px] font-extrabold tracking-tight m-0">Manufacturing Agentic AI</h1>
          <p className="mt-3 text-[14px] text-muted">License Required</p>
        </div>

        <div className="mb-6 text-center text-[14px] text-muted leading-relaxed">
          Your MAI license is required before signing in.
        </div>

        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            onFileSelected(event.dataTransfer.files?.[0] ?? null);
          }}
          className="border border-dashed border-border-color rounded-2xl p-5 bg-[#121a2d] text-center cursor-pointer hover:border-teal/50 transition"
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".lic"
            className="hidden"
            onChange={(event) => onFileSelected(event.target.files?.[0] ?? null)}
          />
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-full bg-teal/10 p-3">
              <UploadCloud className="h-6 w-6 text-teal" />
            </div>
            <div className="text-[13px] text-muted">
              {file ? file.name : 'Drag & Drop .lic file here'}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex-1 rounded-xl border border-border-color bg-[#171D2F] px-4 py-3 text-[13px] font-semibold text-white"
          >
            Browse License
          </button>
          <button
            type="button"
            onClick={() => void handleVerify()}
            disabled={loading || !file}
            className="flex-1 rounded-xl bg-teal px-4 py-3 text-[13px] font-bold text-[#04131b] disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Verify License'}
          </button>
        </div>

        <div className="mt-6 rounded-xl border border-border-color bg-[#0f1728] p-4">
          <div className="text-[11px] uppercase tracking-wider text-muted mb-2">Status</div>
          <div className="flex items-start gap-2 text-[14px] leading-relaxed">
            {status.includes('✓') ? <CheckCircle2 className="h-4 w-4 text-green mt-0.5" /> : status.includes('✕') ? <AlertCircle className="h-4 w-4 text-red mt-0.5" /> : <FileUp className="h-4 w-4 text-muted mt-0.5" />}
            <span className={status.includes('✕') ? 'text-red' : 'text-white'}>{status}</span>
          </div>
          {message && <div className="mt-3 whitespace-pre-line text-[12.5px] text-muted">{message}</div>}
        </div>

        <div className="mt-6 text-center text-[11.5px] text-muted">
          Support: admin@mai.local • +1 (800) 555-0142
        </div>
      </div>
    </div>
  );
};
