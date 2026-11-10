export const TELEMETRY_TIME_ZONE = 'Asia/Kolkata';

const hasExplicitTimeZone = (value: string) => /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value.trim());

export const telemetryDate = (value: string | number | Date): Date => {
  if (value instanceof Date || typeof value === 'number') return new Date(value);
  const timestamp = value.trim();
  return new Date(hasExplicitTimeZone(timestamp) ? timestamp : `${timestamp}Z`);
};

const isValid = (date: Date) => Number.isFinite(date.getTime());

export const telemetryTimestamp = (value: string | number | Date): number => telemetryDate(value).getTime();

export const formatTelemetryTime = (value: string | number | Date): string => {
  const date = telemetryDate(value);
  if (!isValid(date)) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: TELEMETRY_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(date);
};

export const formatTelemetryDateTime = (value: string | number | Date): string => {
  const date = telemetryDate(value);
  if (!isValid(date)) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: TELEMETRY_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  }).format(date);
};
