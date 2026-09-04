import React, { useState, useEffect } from 'react';

interface ChartCardWrapperProps {
  id: string;
  title: string;
  subtitle?: string;
  badgeText?: string;
  colSpan?: string;
  children: React.ReactNode;
  onRemove?: () => void;
  isDragActive?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
}

export const ChartCardWrapper: React.FC<ChartCardWrapperProps> = ({
  id,
  title,
  subtitle,
  badgeText,
  colSpan = 'col-span-1',
  children,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Close on ESC key when in fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  return (
    <>
      {/* Standard Card view */}
      <div
        id={`chart-card-${id}`}
        draggable
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={`bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-700 transition-all group ${colSpan}`}
      >
        <div className="flex items-start justify-between mb-3 gap-2">
          <div className="flex items-center gap-2">
            {/* Drag Handle Indicator */}
            <div
              className="cursor-grab active:cursor-grabbing p-1 text-slate-600 hover:text-slate-300 rounded transition-colors"
              title="Drag & Drop to reorder chart"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="9" cy="5" r="1.5" />
                <circle cx="15" cy="5" r="1.5" />
                <circle cx="9" cy="12" r="1.5" />
                <circle cx="15" cy="12" r="1.5" />
                <circle cx="9" cy="19" r="1.5" />
                <circle cx="15" cy="19" r="1.5" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
              {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {badgeText && (
              <span className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                {badgeText}
              </span>
            )}

            {/* Fullscreen Zoom Toggle Button */}
            <button
              onClick={() => setIsFullscreen(true)}
              className="p-1.5 text-slate-500 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Maximize / Fullscreen Zoom"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {/* Remove / Delete Chart Button */}
            {onRemove && (
              <button
                onClick={onRemove}
                className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Remove Chart from View"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Chart Content Container */}
        <div className="flex-1 w-full min-h-0">{children}</div>
      </div>

      {/* Fullscreen Zoom Modal Dialog */}
      {isFullscreen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-md bg-black/85 animate-fadeIn"
          onClick={() => setIsFullscreen(false)}
        >
          <div
            className="relative w-full max-w-6xl h-[85vh] bg-slate-900 border border-slate-700 rounded-3xl p-6 flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Fullscreen Header */}
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                  <h2 className="text-xl font-bold text-slate-100">{title}</h2>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-semibold">
                    FULLSCREEN ZOOM MODE
                  </span>
                </div>
                {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsFullscreen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Minimize (ESC)
                </button>
              </div>
            </div>

            {/* Scaled Fullscreen Viewport */}
            <div className="flex-1 w-full h-full min-h-0 overflow-y-auto p-4 bg-slate-950/60 rounded-2xl border border-slate-800/80 flex flex-col justify-center">
              {children}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
