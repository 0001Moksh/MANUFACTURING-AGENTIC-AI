import React from 'react';

export interface ChartDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
  colSpan: string;
  isVisible: boolean;
}

interface ChartCustomizationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  charts: ChartDefinition[];
  onToggleChart: (id: string) => void;
  onResetLayout: () => void;
}

export const ChartCustomizationDrawer: React.FC<ChartCustomizationDrawerProps> = ({
  isOpen,
  onClose,
  charts,
  onToggleChart,
  onResetLayout,
}) => {
  if (!isOpen) return null;

  const activeCount = charts.filter((c) => c.isVisible).length;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end backdrop-blur-sm bg-slate-900/40 transition-all duration-300 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white border-l border-slate-200 h-full flex flex-col shadow-2xl overflow-hidden animate-slideLeft"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-800">Dashboard Layout Manager</h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                {activeCount} Active
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Toggle visibility, add/remove chart widgets, and customize layout
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer border border-slate-200"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Chart Library List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Available Analytics Library
            </span>
            <button
              onClick={onResetLayout}
              className="text-xs font-medium text-blue-600 hover:text-blue-800 underline cursor-pointer"
            >
              Reset Defaults
            </button>
          </div>

          <div className="space-y-3">
            {charts.map((chart) => (
              <div
                key={chart.id}
                onClick={() => onToggleChart(chart.id)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                  chart.isVisible
                    ? 'bg-blue-50/80 border-blue-300 shadow-sm'
                    : 'bg-slate-50/60 border-slate-200 opacity-70 hover:opacity-100 hover:border-slate-300'
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-700">{chart.name}</span>
                    <span className="text-[9px] px-2 py-0.5 rounded bg-white text-slate-500 border border-slate-200 font-mono">
                      {chart.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">{chart.description}</p>
                </div>

                {/* Switch Toggle Control */}
                <div
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${
                    chart.isVisible ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                      chart.isVisible ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="p-5 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-200 transition-all cursor-pointer text-center"
          >
            Apply & Save Layout
          </button>
        </div>
      </div>
    </div>
  );
};
