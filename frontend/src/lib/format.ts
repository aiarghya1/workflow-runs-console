const numberFormat = new Intl.NumberFormat('en-US');
const dateFormat = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});

export const formatNumber = (value: number) => numberFormat.format(value);

export const formatLatency = (ms: number) => (ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`);

/** Operators across time zones compare runs, so timestamps are always shown in UTC. */
export const formatDateTime = (iso: string) => `${dateFormat.format(new Date(iso))} UTC`;
