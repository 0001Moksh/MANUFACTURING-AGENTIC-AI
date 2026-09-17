import { create } from 'zustand';
import { telemetryService } from '../services/api';
import type { Machine, MachineStatus, LiveMetric } from '../data/machineMonitoringData';

interface MachineState {
  machines: Machine[];
  loading: boolean;
  error: string | null;
  loadMachines: () => Promise<void>;
  updateMachineMetric: (machineId: string, metricKey: string, newValue: number | null) => void;
}

export function computeMachineHealth(machine: Machine, liveMetrics: LiveMetric[]): { healthScore: number; status: MachineStatus } {
  if (machine.status === 'Offline') return { healthScore: 0, status: 'Offline' };

  const availableMetrics = liveMetrics.filter((metric) => metric.value !== null);
  const hasCritical = availableMetrics.some((metric) => metric.status === 'critical');
  const hasWarning = availableMetrics.some((metric) => metric.status === 'warning');
  const penalty = availableMetrics.reduce((total, metric) => (
    total + (metric.status === 'critical' ? 35 : metric.status === 'warning' ? 15 : 0)
  ), 0);

  return {
    healthScore: Math.max(0, Math.min(100, Math.round(100 - penalty))),
    status: hasCritical ? 'Critical' : hasWarning ? 'Warning' : 'Healthy',
  };
}

export const useMachineStore = create<MachineState>((set) => ({
  machines: [],
  loading: false,
  error: null,

  loadMachines: async () => {
    set({ loading: true, error: null });
    try {
      const response = await telemetryService.getMachineMonitoring();
      set({ machines: response.machines ?? [], loading: false, error: null });
    } catch (error: any) {
      const detail = error?.response?.data?.detail || error?.message || 'Unable to load InfluxDB telemetry';
      set({ machines: [], loading: false, error: String(detail) });
    }
  },

  updateMachineMetric: (machineId, metricKey, newValue) => {
    set((state) => ({
      machines: state.machines.map((machine) => {
        if (machine.id !== machineId) return machine;
        const liveMetrics = machine.liveMetrics.map((metric) => (
          metric.key === metricKey ? { ...metric, value: newValue } : metric
        ));
        const health = computeMachineHealth(machine, liveMetrics);
        return { ...machine, ...health, liveMetrics, metrics: liveMetrics };
      }),
    }));
  },
}));
