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

export const EvidenceModal: React.FC<EvidenceModalProps> = ({ alert, onClose }) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageError, setImageError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Close on ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Reset zoom/pan when alert changes
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

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.3, 3));
  const handleZoomOut = () => {
    setZoom((prev) => {
      const next = Math.max(prev - 0.3, 1);
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
      if (navigator.clipboard && navigator.clipboard.writeText) {
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
      // Direct window open fallback
      window.open(resolvedImageUrl, '_blank');
    } finally {
      setIsDownloading(false);
    }
  };

  const getSeverityBadgeClass = (severity?: string) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL':
        return 'bg-red-500/20 text-red-400 border-red-500/40';
      case 'WARNING':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      default:
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/75 transition-all duration-300 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100">Visual Evidence Log</h3>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded border uppercase tracking-wider ${getSeverityBadgeClass(
                    alert.severity
                  )}`}
                >
                  {alert.severity || 'ALERT'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Incident #{alert.id} &bull; {cameraLabel} &bull;{' '}
                <span className="font-mono text-cyan-400">{alert.timestamp || 'Real-Time'}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
            title="Close (ESC)"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Modal Main Content / Viewport */}
        <div
          ref={containerRef}
          className="relative flex-1 bg-slate-950 overflow-hidden flex items-center justify-center min-h-[380px] max-h-[600px] select-none"
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
              className="max-w-full max-h-full object-contain transition-transform duration-100"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              }}
              draggable={false}
            />
          ) : (
            /* Clean Fallback Placeholder Card */
            <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-900/90 rounded-2xl border border-dashed border-slate-700 max-w-lg mx-auto">
              <div className="w-16 h-16 rounded-full bg-red-950/60 border border-red-800/60 flex items-center justify-center text-red-400 mb-4 shadow-inner">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <h4 className="text-base font-bold text-slate-100 mb-1">Local Asset Resolution Offline</h4>
              <p className="text-xs text-slate-400 mb-4 max-w-sm">
                Snapshot file reference is unavailable or path is invalid. Evidence details recorded in database:
              </p>

              <div className="w-full bg-slate-950/80 rounded-xl p-3 text-left border border-slate-800 space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Alert ID:</span>
                  <span className="text-slate-200">#{alert.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Violation Type:</span>
                  <span className="text-amber-400 font-semibold">{displayLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Camera Stream:</span>
                  <span className="text-cyan-400">{cameraLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Local Path:</span>
                  <span className="text-slate-400 truncate max-w-[220px]" title={assetPath}>
                    {assetPath}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Zoom Overlay Pill */}
          {zoom > 1 && (
            <div className="absolute top-4 right-4 bg-slate-900/80 backdrop-blur-md border border-slate-700 text-cyan-400 text-xs font-semibold px-3 py-1 rounded-full shadow-lg">
              {Math.round(zoom * 100)}% Zoom &bull; Drag to Pan
            </div>
          )}
        </div>

        {/* Modal Toolbar & Footer Actions */}
        <div className="px-6 py-4 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          {/* Zoom / Pan Controls */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
            <button
              onClick={handleZoomOut}
              disabled={zoom <= 1}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 rounded-lg transition-colors cursor-pointer"
              title="Zoom Out"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
            </button>
            <span className="text-xs font-mono text-slate-300 px-2 min-w-[45px] text-center font-bold">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              disabled={zoom >= 3}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 rounded-lg transition-colors cursor-pointer"
              title="Zoom In"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="11" y1="8" x2="11" y2="14" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
            </button>
            {zoom > 1 && (
              <button
                onClick={handleResetZoom}
                className="text-[10px] font-semibold text-slate-400 hover:text-white px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded-md ml-1 transition-colors cursor-pointer"
              >
                Reset 1:1
              </button>
            )}
          </div>

          {/* Action Buttons: Copy & Download & Close */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                copied
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
              </svg>
              {copied ? 'Path Copied!' : 'Copy Path / Link'}
            </button>

            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-lg transition-all cursor-pointer disabled:opacity-50"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {isDownloading ? 'Saving...' : 'Download Snapshot'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
