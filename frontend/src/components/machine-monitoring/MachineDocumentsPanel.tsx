import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, Eye, FileSpreadsheet, FileText, Pencil, Plus, ShieldCheck, Trash2, Upload, X } from 'lucide-react';
import { machineMonitoringService } from '../../services/api';

type MachineDocument = {
  id: number;
  title: string;
  document_type: string;
  original_filename: string;
  mime_type?: string | null;
  file_size: number;
  uploaded_by?: string | null;
  created_at: string;
  updated_at: string;
};

const DOCUMENT_TYPES = [
  'Repair Guide', 'Machine Documentation', 'User Guide', 'Service Manual',
  'Maintenance Guide', 'Troubleshooting Guide', 'Safety Document', 'Technical Document',
];

const TYPE_CODES: Record<string, string> = {
  'Repair Guide': 'RG', 'Machine Documentation': 'MD', 'User Guide': 'UG', 'Service Manual': 'SM',
  'Maintenance Guide': 'MM', 'Troubleshooting Guide': 'TG', 'Safety Document': 'SaM', 'Technical Document': 'TM',
};

const readableSize = (size: number) => size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;
const extensionOf = (filename: string) => filename.split('.').pop()?.toUpperCase() || 'FILE';

export const MachineDocumentsPanel: React.FC<{ machineId: string }> = ({ machineId }) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<MachineDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [documentType, setDocumentType] = useState('Machine Documentation');
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [editing, setEditing] = useState<MachineDocument | null>(null);
  const [preview, setPreview] = useState<{ doc: MachineDocument; url: string } | null>(null);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const response = await machineMonitoringService.getDocuments(machineId);
      setDocuments(response.documents ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load machine documents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadDocuments(); }, [machineId]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);

  const selectFile = (file?: File) => {
    if (!file) return;
    setSelectedFile(file);
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''));
  };

  const upload = async () => {
    if (!selectedFile || !title.trim()) return;
    setUploading(true);
    try {
      await machineMonitoringService.uploadDocument(machineId, selectedFile, title.trim(), documentType);
      setSelectedFile(null); setTitle(''); setDocumentType('Machine Documentation'); setShowUpload(false);
      if (fileInput.current) fileInput.current.value = '';
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to upload the document.');
    } finally { setUploading(false); }
  };

  const download = async (doc: MachineDocument) => {
    try {
      const blob = await machineMonitoringService.getDocumentFile(machineId, doc.id, true);
      const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
      anchor.href = url; anchor.download = doc.original_filename; anchor.click(); URL.revokeObjectURL(url);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to download the document.'); }
  };

  const openPreview = async (doc: MachineDocument) => {
    try {
      const blob = await machineMonitoringService.getDocumentFile(machineId, doc.id);
      setPreview({ doc, url: URL.createObjectURL(blob) });
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to preview the document.'); }
  };

  const remove = async (doc: MachineDocument) => {
    if (!window.confirm(`Delete “${doc.title}”? This removes the locally stored file as well.`)) return;
    try { await machineMonitoringService.deleteDocument(machineId, doc.id); await loadDocuments(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to delete the document.'); }
  };

  const saveEdit = async () => {
    if (!editing || !editing.title.trim()) return;
    try {
      await machineMonitoringService.updateDocument(machineId, editing.id, editing.title.trim(), editing.document_type);
      setEditing(null); await loadDocuments();
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to update the document.'); }
  };

  const previewable = preview && ['PDF', 'TXT', 'MD'].includes(extensionOf(preview.doc.original_filename));

  return <div className="space-y-5">
    <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-[0_2px_16px_-6px_rgba(15,23,42,0.06)]">
      <div className="absolute right-0 top-0 h-24 w-48 bg-gradient-to-bl from-teal/10 to-transparent" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-teal/20 bg-teal/10 text-teal"><FileText className="h-5 w-5" /></div>
          <div><h3 className="font-head text-[16px] font-extrabold text-slate-800">Machine Documents</h3><p className="mt-0.5 text-[12px] text-slate-500">Guides, manuals, procedures and technical records for this machine.</p></div>
        </div>
        <button onClick={() => setShowUpload(v => !v)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal px-4 py-2.5 text-[12px] font-bold text-white shadow-sm transition-colors hover:bg-teal/90"><Plus className="h-4 w-4" /> Upload document</button>
      </div>
      <div className="relative mt-5 flex flex-wrap gap-2 text-[10.5px] font-semibold text-slate-500"><span className="rounded-full bg-slate-100 px-2.5 py-1">PDF</span><span className="rounded-full bg-slate-100 px-2.5 py-1">Word</span><span className="rounded-full bg-slate-100 px-2.5 py-1">Excel</span><span className="rounded-full bg-slate-100 px-2.5 py-1">README / Markdown</span><span className="ml-auto flex items-center gap-1 text-emerald-700"><ShieldCheck className="h-3.5 w-3.5" /> Stored locally</span></div>
    </section>

    <AnimatePresence>{showUpload && <motion.section initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden rounded-2xl border border-teal/20 bg-teal/[0.03] p-5">
      <div className="mb-4 flex items-center justify-between"><div><h4 className="text-[14px] font-bold text-slate-800">Add a machine document</h4><p className="mt-0.5 text-[11.5px] text-slate-500">Up to 25 MB. PDF, Word, Excel, TXT or Markdown.</p></div><button onClick={() => setShowUpload(false)} className="rounded-lg p-1 text-slate-400 hover:bg-white hover:text-slate-700"><X className="h-4 w-4" /></button></div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-end">
        <label className="block"><span className="mb-1.5 block text-[11px] font-bold text-slate-600">Document file</span><button type="button" onClick={() => fileInput.current?.click()} className="flex w-full items-center gap-2 rounded-xl border border-dashed border-teal/40 bg-white px-3 py-2.5 text-left text-[12px] text-slate-600 hover:border-teal"><Upload className="h-4 w-4 text-teal" /><span className="truncate">{selectedFile?.name || 'Choose a file'}</span></button><input ref={fileInput} className="hidden" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.md,text/plain,application/pdf" onChange={e => selectFile(e.target.files?.[0])} /></label>
        <label className="block"><span className="mb-1.5 block text-[11px] font-bold text-slate-600">Title</span><input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Hydraulic service manual" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[12px] outline-none focus:border-teal" /></label>
        <label className="block"><span className="mb-1.5 block text-[11px] font-bold text-slate-600">Category</span><select value={documentType} onChange={e => setDocumentType(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[12px] outline-none focus:border-teal">{DOCUMENT_TYPES.map(type => <option key={type}>{type}</option>)}</select></label>
        <button disabled={!selectedFile || !title.trim() || uploading} onClick={upload} className="rounded-xl bg-slate-900 px-4 py-2.5 text-[12px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-45">{uploading ? 'Uploading…' : 'Save document'}</button>
      </div>
    </motion.section>}</AnimatePresence>

    {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] text-rose-700">{error}</div>}
    <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_2px_16px_-6px_rgba(15,23,42,0.06)]">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h4 className="text-[14px] font-bold text-slate-800">Document library</h4><p className="mt-0.5 text-[11px] text-slate-500">{documents.length} document{documents.length === 1 ? '' : 's'} available</p></div></div>
      {loading ? <div className="p-10 text-center text-[12px] text-slate-400">Loading document library…</div> : documents.length === 0 ? <div className="p-10 text-center"><div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-400"><FileText className="h-5 w-5" /></div><p className="text-[13px] font-bold text-slate-700">No documents yet</p><p className="mt-1 text-[11.5px] text-slate-500">Upload a repair guide, manual, safety document or technical reference.</p></div> : <div className="divide-y divide-slate-100">{documents.map(doc => <div key={doc.id} className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-slate-50/70 sm:flex-row sm:items-center">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal/10 text-[10px] font-extrabold text-teal">{extensionOf(doc.original_filename) === 'XLSX' || extensionOf(doc.original_filename) === 'XLS' ? <FileSpreadsheet className="h-5 w-5" /> : extensionOf(doc.original_filename)}</div>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-[13px] font-bold text-slate-800">{doc.title}</p><span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9.5px] font-bold text-slate-500">{TYPE_CODES[doc.document_type] || 'DOC'} · {doc.document_type}</span></div><p className="mt-1 truncate text-[11px] text-slate-500">{doc.original_filename} <span className="mx-1 text-slate-300">•</span> {readableSize(doc.file_size)} <span className="mx-1 text-slate-300">•</span> Updated {new Date(doc.updated_at).toLocaleDateString()} {doc.uploaded_by ? `by ${doc.uploaded_by}` : ''}</p></div>
        <div className="flex items-center gap-1"><button onClick={() => void openPreview(doc)} title="Preview" className="rounded-lg p-2 text-slate-500 hover:bg-teal/10 hover:text-teal"><Eye className="h-4 w-4" /></button><button onClick={() => void download(doc)} title="Download" className="rounded-lg p-2 text-slate-500 hover:bg-teal/10 hover:text-teal"><Download className="h-4 w-4" /></button><button onClick={() => setEditing({ ...doc })} title="Edit details" className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-800"><Pencil className="h-4 w-4" /></button><button onClick={() => void remove(doc)} title="Delete" className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></div>
      </div>)}</div>}
    </section>

    <AnimatePresence>{(editing || preview) && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
      {editing && <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"><div className="mb-4 flex items-center justify-between"><h4 className="font-head text-[16px] font-bold text-slate-800">Edit document details</h4><button onClick={() => setEditing(null)}><X className="h-5 w-5 text-slate-400" /></button></div><label className="mb-3 block text-[11px] font-bold text-slate-600">Title<input value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[12px] outline-none focus:border-teal" /></label><label className="block text-[11px] font-bold text-slate-600">Category<select value={editing.document_type} onChange={e => setEditing({ ...editing, document_type: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[12px] outline-none focus:border-teal">{DOCUMENT_TYPES.map(type => <option key={type}>{type}</option>)}</select></label><div className="mt-5 flex justify-end gap-2"><button onClick={() => setEditing(null)} className="rounded-xl px-3 py-2 text-[12px] font-bold text-slate-500">Cancel</button><button onClick={() => void saveEdit()} className="rounded-xl bg-teal px-4 py-2 text-[12px] font-bold text-white">Save changes</button></div></div>}
      {preview && <div className="flex h-[min(82vh,760px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-3"><div className="min-w-0"><p className="truncate text-[13px] font-bold text-slate-800">{preview.doc.title}</p><p className="text-[10.5px] text-slate-500">{preview.doc.original_filename}</p></div><div className="flex gap-1"><button onClick={() => void download(preview.doc)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Download className="h-4 w-4" /></button><button onClick={() => setPreview(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button></div></div>{previewable ? <iframe title={preview.doc.title} src={preview.url} className="min-h-0 flex-1 bg-slate-100" /> : <div className="flex flex-1 flex-col items-center justify-center p-8 text-center"><FileText className="mb-3 h-10 w-10 text-teal" /><p className="text-[14px] font-bold text-slate-800">Preview is not available for this Office file</p><p className="mt-1 text-[12px] text-slate-500">Download it to open it in your preferred application.</p><button onClick={() => void download(preview.doc)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-teal px-4 py-2.5 text-[12px] font-bold text-white"><Download className="h-4 w-4" /> Download document</button></div>}</div>}
    </motion.div>}</AnimatePresence>
  </div>;
};
