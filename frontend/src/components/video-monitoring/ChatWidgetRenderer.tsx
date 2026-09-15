import React, { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ShieldAlert, CheckCircle2, XCircle, AlertTriangle, Eye, Table as TableIcon, Image as ImageIcon, Maximize2, Minimize2, X, ChevronLeft, ChevronRight, Camera, Clock, Activity } from 'lucide-react';

export interface SnapshotGalleryItem {
  event_id: number | null;
  snapshot_url: string;
  snapshot_path: string;
  class_name: string;
  severity: string;
  event_time: string;
  camera_name: string;
  zone_id: number | null;
  confidence: number;
  status: string;
}

export interface WidgetPayload {
  type: 'evidence_gallery' | 'snapshot_evidence_widget' | 'data_table' | 'hitl_actions' | 'live_stream_player' | 'snapshot_gallery';
  title?: string;
  description?: string;
  // Snapshot Gallery
  items?: SnapshotGalleryItem[];
  snapshots?: Array<{
    id: number;
    title: string;
    timestamp: string;
    url: string;
    badge?: string;
  }>;
  headers?: string[];
  rows?: string[][];
  actions?: Array<{
    id: string;
    label: string;
    variant?: 'success' | 'danger' | 'secondary' | 'primary';
  }>;
  // Live Stream Player fields
  camera_name?: string;
  camera_location?: string;
  stream_url?: string;
  snapshot_url?: string;
  snapshot_path?: string;
  captured_at?: string;
  frame_count?: number;
  capture_source?: string;
  user_query?: string;
  vlm_instruction?: string;
  vlm_response?: string;
  detections?: Array<Record<string, unknown>>;
  vlm_detections?: Array<{
    entity: string;
    class: string;
    confidence: number;
    helmet: boolean | null;
    vest: boolean | null;
  }>;
  fps?: number;
  resolution?: string;
  status?: string;
}

interface ChatWidgetRendererProps {
  payload: WidgetPayload;
  onActionClick?: (actionId: string, label: string) => void;
}

const SEVERITY_STYLES: Record<string, { badge: string; border: string; dot: string }> = {
  CRITICAL: { badge: 'bg-red-600/90 text-white',       border: 'border-red-500/50',    dot: 'bg-red-500' },
  MAJOR:    { badge: 'bg-orange-600/90 text-white',    border: 'border-orange-500/50', dot: 'bg-orange-500' },
  WARNING:  { badge: 'bg-yellow-600/90 text-white',    border: 'border-yellow-500/50', dot: 'bg-yellow-400' },
  NORMAL:   { badge: 'bg-slate-600/90 text-slate-200', border: 'border-slate-600/50',  dot: 'bg-slate-400' },
};

export const ChatWidgetRenderer: React.FC<ChatWidgetRendererProps> = ({ payload, onActionClick }) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<SnapshotGalleryItem | null>(null);
  const [streamError, setStreamError] = useState(false);
  const [streamOpen, setStreamOpen] = useState(true);
  const [streamFullscreen, setStreamFullscreen] = useState(false);
  const galleryRef = useRef<HTMLDivElement>(null);

  const scrollGallery = (dir: 'left' | 'right') => {
    if (galleryRef.current) {
      galleryRef.current.scrollBy({ left: dir === 'left' ? -280 : 280, behavior: 'smooth' });
    }
  };

  // ── Snapshot Gallery ────────────────────────────────────────────────────
  if (payload.type === 'snapshot_gallery') {
    const items = payload.items || [];
    if (items.length === 0) return null;

    return (
      <div className="mt-3 w-full bg-slate-900/95 border border-amber-500/30 rounded-xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-3.5 pt-3 pb-2.5 border-b border-slate-800">
          <Camera className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-amber-400 font-semibold text-xs uppercase tracking-wider truncate">
            {payload.title || 'Alert Snapshots'}
          </span>
          <span className="ml-auto text-[10px] text-slate-500 font-mono shrink-0">
            {items.length} frames
          </span>
        </div>

        {/* Scroll wrapper */}
        <div className="relative group">
          {/* Left scroll btn */}
          <button
            type="button"
            aria-label="Scroll left"
            onClick={() => scrollGallery('left')}
            className="absolute left-1 top-1/2 -translate-y-1/2 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-slate-950/80 text-white border border-slate-700 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-800"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Horizontal scroll track */}
          <div
            ref={galleryRef}
            className="flex gap-3 px-3.5 py-3 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent scroll-smooth"
            style={{ scrollSnapType: 'x mandatory' }}
          >
            {items.map((item, idx) => {
              const sev = SEVERITY_STYLES[item.severity?.toUpperCase()] || SEVERITY_STYLES['NORMAL'];
              const cardImgUrl = item.snapshot_url || (item.event_id ? `/api/video-monitoring/alert-image/${item.event_id}` : '');
              return (
                <div
                  key={item.event_id ?? idx}
                  onClick={() => setSelectedItem(item)}
                  style={{ scrollSnapAlign: 'start', minWidth: '200px', maxWidth: '200px' }}
                  className={`relative flex-shrink-0 cursor-pointer rounded-xl overflow-hidden border ${sev.border} bg-slate-950 hover:border-amber-400/70 transition-all duration-200 group/card shadow-md hover:shadow-amber-500/10 hover:-translate-y-0.5`}
                >
                  {/* Image */}
                  <div className="relative w-full h-[112px] bg-slate-900 overflow-hidden">
                    <img
                      src={cardImgUrl}
                      alt={`Alert #${item.event_id} — ${item.class_name}`}
                      className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        img.onerror = null;
                        img.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22112%22%3E%3Crect fill=%22%231e293b%22 width=%22200%22 height=%22112%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%2364748b%22 font-size=%2212%22%3ENo Image%3C/text%3E%3C/svg%3E';
                      }}
                    />
                    {/* Severity badge top-left */}
                    <span className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 text-[9px] font-bold rounded ${sev.badge} uppercase tracking-wide`}>
                      {item.severity}
                    </span>
                    {/* Expand icon top-right */}
                    <div className="absolute top-1.5 right-1.5 opacity-0 group-hover/card:opacity-100 transition-opacity">
                      <Maximize2 className="w-3 h-3 text-white drop-shadow" />
                    </div>
                    {/* Camera name bottom overlay */}
                    <div className="absolute bottom-0 inset-x-0 h-6 bg-gradient-to-t from-slate-950/90 to-transparent flex items-end px-2 pb-1">
                      <span className="text-[9px] font-mono text-slate-300 truncate">{item.camera_name}</span>
                    </div>
                  </div>

                  {/* Caption */}
                  <div className="p-2 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sev.dot}`} />
                      <span className="text-[11px] font-semibold text-slate-100 truncate">{item.class_name}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[9px] text-slate-500">
                      <Clock className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate">{item.event_time}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-slate-500 font-mono">ID #{item.event_id}</span>
                      <span className={`text-[9px] px-1 py-0.5 rounded font-medium ${item.status === 'ACKNOWLEDGED' ? 'bg-emerald-900/60 text-emerald-400' : 'bg-slate-800 text-slate-400'
                        }`}>
                        {item.status === 'ACKNOWLEDGED' ? '✓ ACK' : 'OPEN'}
                      </span>
                    </div>
                    {item.confidence > 0 && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Activity className="w-2.5 h-2.5 text-slate-600 shrink-0" />
                        <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-500/70 rounded-full"
                            style={{ width: `${Math.round(item.confidence * 100)}%` }}
                          />
                        </div>
                        <span className="text-[9px] text-slate-500 font-mono">{Math.round(item.confidence * 100)}%</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right scroll btn */}
          <button
            type="button"
            aria-label="Scroll right"
            onClick={() => scrollGallery('right')}
            className="absolute right-1 top-1/2 -translate-y-1/2 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-slate-950/80 text-white border border-slate-700 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-800"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Expanded Modal (Visual Evidence) */}
        {selectedItem && (() => {
          const mSev = SEVERITY_STYLES[selectedItem.severity?.toUpperCase()] || SEVERITY_STYLES['NORMAL'];
          const mImgUrl = selectedItem.snapshot_url || (selectedItem.event_id ? `/api/video-monitoring/alert-image/${selectedItem.event_id}` : '');
          return (
            <div
              className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 backdrop-blur-sm"
              onClick={() => setSelectedItem(null)}
            >
              <div
                className="relative bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/70">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`w-2.5 h-2.5 rounded-full ${mSev.dot}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white tracking-tight">Visual Evidence</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${mSev.badge} uppercase tracking-wider`}>
                          {selectedItem.severity}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 truncate">
                        <span className="text-slate-300 font-mono">#{selectedItem.event_id}</span>
                        <span className="mx-1.5 text-slate-600">·</span>
                        <span className="text-amber-400">{selectedItem.camera_name}</span>
                        <span className="mx-1.5 text-slate-600">·</span>
                        <span>{selectedItem.event_time}</span>
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedItem(null)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Main Snapshot Image */}
                <div className="relative bg-black flex items-center justify-center overflow-hidden min-h-[260px] max-h-[50vh]">
                  <img
                    src={mImgUrl}
                    alt={`Evidence for Alert #${selectedItem.event_id}`}
                    className="max-w-full max-h-[50vh] object-contain"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      img.onerror = null;
                      img.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22240%22%3E%3Crect fill=%22%231e293b%22 width=%22400%22 height=%22240%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%2364748b%22 font-size=%2214%22%3EImage not available on disk%3C/text%3E%3C/svg%3E';
                    }}
                  />
                </div>

                {/* Footer details & Action buttons */}
                <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 text-xs">
                    <div className="bg-slate-800/80 px-2.5 py-1 rounded-md text-slate-300">
                      <span className="text-slate-500 mr-1.5">Violation:</span>
                      <strong className="text-white">{selectedItem.class_name}</strong>
                    </div>
                    {selectedItem.confidence > 0 && (
                      <div className="bg-slate-800/80 px-2.5 py-1 rounded-md text-slate-300 font-mono">
                        <span className="text-slate-500 mr-1.5">Conf:</span>
                        {Math.round(selectedItem.confidence * 100)}%
                      </div>
                    )}
                    <div className="bg-slate-800/80 px-2.5 py-1 rounded-md">
                      <span className={selectedItem.status === 'ACKNOWLEDGED' ? 'text-emerald-400' : 'text-amber-400'}>
                        {selectedItem.status}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (mImgUrl) {
                          navigator.clipboard?.writeText(window.location.origin + mImgUrl);
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                    >
                      Copy Link
                    </button>
                    <a
                      href={mImgUrl}
                      download={`alert_${selectedItem.event_id}.jpg`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                    >
                      Download
                    </a>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    );
  }
    );
  }

  if (payload.type === 'snapshot_evidence_widget') {
    return (
      <div className="mt-3 w-full max-w-[430px] p-3 bg-slate-900/95 border border-emerald-500/30 rounded-xl shadow-xl overflow-hidden">
        <div className="flex items-center gap-2 mb-2.5 text-emerald-400 font-semibold text-xs uppercase tracking-wider">
          <ImageIcon className="w-4 h-4" />
          <span>{payload.title || 'Live Snapshot Evidence'}</span>
          <span className="ml-auto text-[10px] text-slate-400 normal-case">1 frame</span>
        </div>
        <div className="relative w-full max-w-[400px] max-h-[225px] aspect-video rounded-lg overflow-hidden bg-slate-950 border border-slate-700">
          <img
            src={payload.snapshot_url}
            alt={`Captured live snapshot — ${payload.camera_name}`}
            className="w-full h-full max-w-[400px] max-h-[225px] object-cover rounded-lg cursor-pointer"
            onClick={() => setSelectedImage(payload.snapshot_url || null)}
          />
          <button
            type="button"
            aria-label="Expand snapshot"
            title="Expand snapshot"
            onClick={() => setSelectedImage(payload.snapshot_url || null)}
            className="absolute right-2 top-2 rounded-md bg-slate-950/80 p-1.5 text-white hover:bg-slate-800 transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <span className="absolute bottom-2 left-2 px-1.5 py-0.5 text-[10px] font-mono text-white bg-slate-950/80 rounded">
            {payload.camera_name}
          </span>
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-slate-400 font-mono">
          <span>{payload.capture_source || 'RTSP live frame'}</span>
          <span>{payload.captured_at ? new Date(payload.captured_at).toLocaleTimeString() : 'Just captured'}</span>
        </div>
        {payload.vlm_response && (
          <div className="mt-2 border-t border-slate-700 pt-2 prose prose-invert prose-xs max-w-none text-slate-200 leading-relaxed [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_strong]:text-emerald-300">
            <ReactMarkdown remarkPlugins={[remarkGfm as any]}>{payload.vlm_response}</ReactMarkdown>
          </div>
        )}
        {selectedImage && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setSelectedImage(null)}>
            <div className="relative max-w-4xl w-full bg-slate-900 border border-slate-700 rounded-xl overflow-hidden p-2" onClick={(event) => event.stopPropagation()}>
              <img src={selectedImage} alt={`Expanded snapshot — ${payload.camera_name}`} className="w-full h-auto max-h-[85vh] object-contain rounded-lg" />
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                className="absolute top-4 right-4 bg-slate-800/90 text-white p-1.5 rounded-full hover:bg-slate-700 transition-colors"
                aria-label="Close snapshot"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (payload.type === 'live_stream_player') {
    if (!streamOpen) return null;

    return (
      <div className={`mt-3 w-full ${streamFullscreen ? 'fixed inset-0 z-50 max-w-none h-screen p-5 bg-slate-950/95' : 'max-w-[430px] p-3'} border border-cyan-500/30 rounded-xl shadow-xl overflow-hidden`}>
        {/* Header */}
        <div className="flex items-center gap-2 mb-2.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">LIVE</span>
          </div>
          <span className="text-cyan-400 font-semibold text-xs uppercase tracking-wider truncate">
            {payload.title || `Live Feed — ${payload.camera_name}`}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => setStreamFullscreen((value) => !value)}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
              aria-label={streamFullscreen ? 'Exit fullscreen stream' : 'Expand live stream'}
              title={streamFullscreen ? 'Exit fullscreen' : 'Expand live stream'}
            >
              {streamFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => setStreamOpen(false)}
              className="p-1.5 text-slate-300 hover:text-red-300 hover:bg-red-950/60 rounded-md transition-colors"
              aria-label="Close live stream"
              title="Close live stream"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Live Stream Frame */}
        <div className={`relative w-full ${streamFullscreen ? 'h-[calc(100vh-90px)] max-w-none' : 'max-w-[400px]'} aspect-video rounded-lg overflow-hidden bg-slate-950 border border-slate-700 mb-2.5`}>
          {!streamError ? (
            <img
              src={payload.stream_url}
              alt={`Live stream — ${payload.camera_name}`}
              className="w-full h-full object-cover rounded-lg"
              onError={() => setStreamError(true)}
            />
          ) : (
            /* Fallback snapshot when MJPEG stream fails to load */
            <img
              src={payload.snapshot_url}
              alt={`Snapshot — ${payload.camera_name}`}
              className="w-full h-full object-cover opacity-80 rounded-lg"
            />
          )}

          {/* Overlay HUD */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Top bar */}
            <div className="absolute top-0 inset-x-0 h-8 bg-gradient-to-b from-slate-950/90 to-transparent flex items-center px-2.5 gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] font-bold text-white font-mono">{payload.camera_name}</span>
              <span className="ml-auto text-[10px] text-slate-400 font-mono">
                {payload.resolution} · {payload.fps} FPS
              </span>
            </div>
            {/* Bottom info */}
            <div className="absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-slate-950/90 to-transparent flex items-center px-2.5">
              <span className="text-[10px] text-slate-400 font-mono">{payload.camera_location}</span>
              <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded ${payload.status === 'STREAMING' ? 'bg-emerald-900/80 text-emerald-400' : 'bg-red-900/80 text-red-400'}`}>
                {payload.status || 'STREAMING'}
              </span>
            </div>
            {/* Corner scan lines effect */}
            <div className="absolute top-8 left-0 w-6 h-6 border-l-2 border-t-2 border-cyan-400/50" />
            <div className="absolute top-8 right-0 w-6 h-6 border-r-2 border-t-2 border-cyan-400/50" />
            <div className="absolute bottom-8 left-0 w-6 h-6 border-l-2 border-b-2 border-cyan-400/50" />
            <div className="absolute bottom-8 right-0 w-6 h-6 border-r-2 border-b-2 border-cyan-400/50" />
          </div>
        </div>
      </div>
    );
  }

  if (payload.type === 'evidence_gallery') {
    return (
      <div className="mt-3 p-3 bg-slate-900/90 border border-amber-500/30 rounded-xl shadow-lg">
        <div className="flex items-center gap-2 mb-2 text-amber-400 font-semibold text-xs uppercase tracking-wider">
          <ImageIcon className="w-4 h-4 text-amber-400" />
          <span>{payload.title || 'Evidence Snapshots'}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {payload.snapshots?.map((snap) => (
            <div
              key={snap.id}
              onClick={() => setSelectedImage(snap.url)}
              className="relative group cursor-pointer overflow-hidden rounded-lg border border-slate-700 hover:border-amber-400 transition-all bg-slate-950"
            >
              <img src={snap.url} alt={snap.title} className="w-full h-20 object-cover group-hover:scale-105 transition-transform" />
              {snap.badge && (
                <span className="absolute top-1 left-1 px-1.5 py-0.5 text-[9px] font-bold bg-red-600/90 text-white rounded">
                  {snap.badge}
                </span>
              )}
              <div className="absolute bottom-0 inset-x-0 bg-slate-950/80 p-1 text-[10px] text-slate-300 truncate flex items-center justify-between">
                <span>{snap.timestamp}</span>
                <Eye className="w-3 h-3 text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          ))}
        </div>

        {/* Modal viewer */}
        {selectedImage && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setSelectedImage(null)}>
            <div className="relative max-w-xl w-full bg-slate-900 border border-slate-700 rounded-xl overflow-hidden p-2">
              <img src={selectedImage} alt="Expanded Evidence" className="w-full h-auto rounded-lg" />
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute top-4 right-4 bg-slate-800/90 text-white p-1.5 rounded-full hover:bg-slate-700 transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (payload.type === 'data_table') {
    return (
      <div className="mt-3 p-3 bg-slate-900/90 border border-cyan-500/30 rounded-xl shadow-lg overflow-hidden">
        <div className="flex items-center gap-2 mb-2 text-cyan-400 font-semibold text-xs uppercase tracking-wider">
          <TableIcon className="w-4 h-4 text-cyan-400" />
          <span>{payload.title || 'Data Insights'}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800/80 text-slate-400 border-b border-slate-700">
                {payload.headers?.map((h, i) => (
                  <th key={i} className="py-1.5 px-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              {payload.rows?.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-800/50 transition-colors">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="py-1.5 px-2">
                      {cell.includes('ONLINE') ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> {cell}
                        </span>
                      ) : cell.includes('OFFLINE') ? (
                        <span className="text-red-400 font-medium">{cell}</span>
                      ) : (
                        cell
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (payload.type === 'hitl_actions') {
    return (
      <div className="mt-3 p-3.5 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border border-amber-500/40 rounded-xl shadow-xl">
        <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
          <ShieldAlert className="w-4 h-4 text-amber-400 animate-bounce" />
          <span>{payload.title || 'Governance Confirmation Required'}</span>
        </div>
        {payload.description && (
          <p className="text-xs text-slate-300 mt-1.5 mb-3 leading-relaxed">
            {payload.description}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {payload.actions?.map((act) => {
            const isSuccess = act.variant === 'success';
            const isDanger = act.variant === 'danger';
            return (
              <button
                key={act.id}
                onClick={() => onActionClick?.(act.id, act.label)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md active:scale-95 ${isSuccess
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/50'
                    : isDanger
                      ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/50'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  }`}
              >
                {isSuccess && <CheckCircle2 className="w-3.5 h-3.5" />}
                {isDanger && <XCircle className="w-3.5 h-3.5" />}
                {!isSuccess && !isDanger && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
                <span>{act.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
};
