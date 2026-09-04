import React, { useState, useEffect, useRef } from 'react';

export interface AlertEvidence {
  id: number;
  severity?: 'CRITICAL' | 'WARNING' | 'NORMAL' | string;
  message?: string;
  timestamp?: string;
  camera_name?: string;
  class_name?: string;
  confidence?: number;
  snapshot_path?: string;
  imageUrl?: string;
}

interface EvidenceModalProps {
  alert: AlertEvidence | null;
  onClose: () => void;
}

/** Human-readable time: "03 Sep · 12:54 PM" */
const formatTime = (ts?: string) => {
  if (!ts) return 'Real-Time';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  const day = d.toLocaleDateString(undefined, { day: '2-digit' });
  const month = d.toLocaleDateString(undefined, { month: 'short' });
  const time = d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${day} ${month} · ${time}`;
};

export const EvidenceModal: React.FC<EvidenceModalProps> = ({ alert, onClose }) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageError, setImageError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Close on ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Reset on alert change
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setImageError(false);
    setCopied(false);
  }, [alert?.id]);

  if (!alert) return null;

  const resolvedImageUrl = alert.imageUrl || `/api/video-monitoring/alert-image/${alert.id}`;
  const displayLabel = alert.class_name || alert.message || 'Safety Violation';
  const cameraLabel = alert.camera_name || 'Monitored Camera Stream';
  const assetPath = alert.snapshot_path || resolvedImageUrl;

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 4));
  const handleZoomOut = () => {
    setZoom((prev) => {
      const next = Math.max(prev - 0.25, 1);
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleCopyLink = async () => {
    try {
      const copyText = window.location.origin + resolvedImageUrl;
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(copyText);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = copyText;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      const response = await fetch(resolvedImageUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `evidence_alert_${alert.id}_${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Failed to download image:', err);
      window.open(resolvedImageUrl, '_blank');
    } finally {
      setIsDownloading(false);
    }
  };

  const getSeverityStyles = (severity?: string) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL':
        return {
          badge: 'bg-red-50 text-red-600 border-red-200',
          dot: 'bg-red-500',
        };
      case 'WARNING':
        return {
          badge: 'bg-amber-50 text-amber-600 border-amber-200',
          dot: 'bg-amber-500',
        };
      default:
        return {
          badge: 'bg-emerald-50 text-emerald-600 border-emerald-200',
          dot: 'bg-emerald-500',
        };
    }
  };

  const sev = getSeverityStyles(alert.severity);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.97) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .modal-in {
          animation: modalIn 0.28s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
      `}</style>

      {/* Almost full-screen container — Light Theme */}
      <div
        className="modal-in relative w-full h-full max-w-[1600px] max-h-[96vh]
                   bg-white border border-slate-200 rounded-2xl shadow-2xl shadow-slate-300/40
                   overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ========== HEADER ========== */}
        <div className="flex-shrink-0 flex items-center justify-between gap-4 px-5 sm:px-7 py-4 border-b border-slate-100 bg-white">
          <div className="flex items-start gap-3.5 min-w-0">
            <span className={`mt-1.5 w-2.5 h-2.5 rounded-full ${sev.dot} shadow-sm`} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="text-[15px] sm:text-base font-bold text-slate-800 tracking-tight">
                  Visual Evidence
                </h3>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border uppercase tracking-wider ${sev.badge}`}
                >
                  {alert.severity || 'ALERT'}
                </span>
              </div>
              <p className="text-[12px] text-slate-500 mt-1 truncate">
                <span className="text-slate-700 font-medium">#{alert.id}</span>
                <span className="mx-1.5 text-slate-300">·</span>
                <span className="text-blue-600">{cameraLabel}</span>
                <span className="mx-1.5 text-slate-300">·</span>
                <span className="tabular-nums text-slate-600">{formatTime(alert.timestamp)}</span>
              </p>
              {alert.message && (
                <p className="text-[12px] text-slate-600 mt-1 line-clamp-1 max-w-2xl">
                  {alert.message}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex-shrink-0 p-2.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100
                       rounded-xl transition-all border border-transparent hover:border-slate-200"
            title="Close (ESC)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* ========== IMAGE VIEWPORT ========== */}
        <div
          ref={containerRef}
          className="relative flex-1 bg-black overflow-hidden flex items-center justify-center select-none min-h-0"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
        >
          {!imageError ? (
            <img
              src={resolvedImageUrl}
              alt={`Evidence for Alert #${alert.id}`}
              onError={() => setImageError(true)}
              className="max-w-full max-h-full object-contain transition-transform duration-75 will-change-transform shadow-sm"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              }}
              draggable={false}
            />
          ) : (
            /* Fallback card */
            <div className="flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-red-500 mb-5">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <h4 className="text-base font-semibold text-slate-800 mb-1.5">
                Snapshot Unavailable
              </h4>
              <p className="text-[13px] text-slate-500 mb-5 leading-relaxed">
                The evidence image could not be loaded. Recorded details are shown below.
              </p>

              <div className="w-full bg-white rounded-xl p-4 text-left border border-slate-200 space-y-2.5 font-mono text-[12px] shadow-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-slate-400">Alert ID</span>
                  <span className="text-slate-700 font-medium">#{alert.id}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-400">Violation</span>
                  <span className="text-amber-600 font-medium truncate max-w-[200px]">{displayLabel}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-400">Camera</span>
                  <span className="text-blue-600 truncate max-w-[200px]">{cameraLabel}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-400">Path</span>
                  <span className="text-slate-500 truncate max-w-[200px]" title={assetPath}>
                    {assetPath}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Zoom indicator */}
          {zoom > 1 && (
            <div className="absolute top-4 right-4 bg-white/95 backdrop-blur border border-slate-200 text-blue-600 text-[11px] font-semibold px-3 py-1.5 rounded-full shadow-md">
              {Math.round(zoom * 100)}% · Drag to pan
            </div>
          )}
        </div>

        {/* ========== FOOTER TOOLBAR ========== */}
        <div className="flex-shrink-0 px-5 sm:px-7 py-3.5 bg-white border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          {/* Zoom controls */}
          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border-1 border-slate-600">
            <button
              onClick={handleZoomOut}
              disabled={zoom <= 1}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-white disabled:opacity-30 rounded-lg transition-colors"
              title="Zoom Out"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
            </button>

            <span className="text-[12px] font-mono text-slate-600 px-2.5 min-w-[52px] text-center font-semibold tabular-nums">
              {Math.round(zoom * 100)}%
            </span>

            <button
              onClick={handleZoomIn}
              disabled={zoom >= 4}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-white disabled:opacity-30 rounded-lg transition-colors"
              title="Zoom In"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="11" y1="8" x2="11" y2="14" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
            </button>

            {zoom > 1 && (
              <button
                onClick={handleResetZoom}
                className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg ml-0.5 transition-colors"
              >
                Reset
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold border transition-all ${
                copied
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
              </svg>
              {copied ? 'Copied!' : 'Copy Link'}
            </button>

            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold
                         bg-blue-600 hover:bg-blue-500 text-white
                         shadow-md shadow-blue-200 transition-all disabled:opacity-50"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {isDownloading ? 'Saving…' : 'Download'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};