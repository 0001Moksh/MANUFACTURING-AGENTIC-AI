import { create } from 'zustand';
import { MOCK_MACHINES, Machine, MachineStatus, LiveMetric } from '../data/machineMonitoringData';

interface MachineState {
  machines: Machine[];
  updateMachineMetric: (machineId: string, metricKey: string, newValue: number) => void;
  tickAllMachines: () => void;
  getMachine: (id: string) => Machine | undefined;
}

/**
 * Compute dynamic health score & status for a machine based on its live metrics
 */
export function computeMachineHealth(machine: Machine, liveMetrics: LiveMetric[]): { healthScore: number; status: MachineStatus } {
  if (machine.status === 'Offline') {
    return { healthScore: 0, status: 'Offline' };
  }

  let hasCritical = false;
  let hasWarning = false;
  let penaltySum = 0;

  liveMetrics.forEach((m) => {
    const val = m.value;
    const [normLo, normHi] = m.normalRange;
    const warn = m.warningThreshold ?? normHi * 1.15;
    const crit = m.criticalThreshold ?? warn * 1.1;

    if (val >= crit || (normLo > 0 && val <= normLo * 0.5)) {
      hasCritical = true;
      const overflow = (val - crit) / (crit || 1);
      penaltySum += 35 + Math.min(30, Math.max(0, overflow * 50));
    } else if (val >= warn || val < normLo) {
      hasWarning = true;
      const overflow = (val - normHi) / ((warn - normHi) || 1);
      penaltySum += 15 + Math.min(20, Math.max(0, overflow * 30));
    } else {
      const mid = (normLo + normHi) / 2;
      const dev = Math.abs(val - mid) / ((normHi - normLo) || 1);
      penaltySum += dev * 2;
    }
  });

  let status: MachineStatus = 'Healthy';
  if (hasCritical) status = 'Critical';
  else if (hasWarning) status = 'Warning';

  const healthScore = Math.max(5, Math.min(100, Math.round(100 - penaltySum)));
  return { healthScore, status };
}

export const useMachineStore = create<MachineState>((set, get) => ({
  machines: MOCK_MACHINES,

  updateMachineMetric: (machineId: string, metricKey: string, newValue: number) => {
    set((state) => {
      const machines = state.machines.map((m) => {
        if (m.id !== machineId) return m;

        const updatedMetrics = m.liveMetrics.map((lm) => {
          if (lm.key !== metricKey) return lm;
          const status = newValue >= lm.criticalThreshold ? 'critical' : newValue >= lm.warningThreshold ? 'warning' : 'normal';
          const newSpark = [...lm.spark.slice(1), { t: lm.spark.length, v: newValue }];
          return { ...lm, value: newValue, status, spark: newSpark };
        });

        const { healthScore, status } = computeMachineHealth(m, updatedMetrics);

        return {
          ...m,
          healthScore,
          status,
          liveMetrics: updatedMetrics,
          metrics: updatedMetrics,
          lastUpdated: 'Just now',
        };
      });

      return { machines };
    });
  },

  tickAllMachines: () => {
    set((state) => {
      const machines = state.machines.map((m) => {
        if (m.status === 'Offline') return m;

        const updatedMetrics = m.liveMetrics.map((lm) => {
          const span = lm.normalRange[1] - lm.normalRange[0];
          // small realistic jitter (~ ±2% of normal span around current value)
          const jitter = (Math.random() - 0.49) * span * 0.05;
          const raw = lm.value + jitter;
          const newValue = Math.round(Math.max(0, raw) * 10) / 10;
          const status = newValue >= lm.criticalThreshold ? 'critical' : newValue >= lm.warningThreshold ? 'warning' : 'normal';
          const newSpark = [...lm.spark.slice(1), { t: lm.spark.length, v: newValue }];
          return { ...lm, value: newValue, status, spark: newSpark };
        });

        const { healthScore, status } = computeMachineHealth(m, updatedMetrics);

        return {
          ...m,
          healthScore,
          status,
          liveMetrics: updatedMetrics,
          metrics: updatedMetrics,
          lastUpdated: 'Just now',
        };
      });

      return { machines };
    });
  },

  getMachine: (id: string) => {
    return get().machines.find((m) => m.id === id);
  },
}));
