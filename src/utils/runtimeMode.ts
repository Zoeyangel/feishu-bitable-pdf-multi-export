export const DASHBOARD_STATES = ['Create', 'Config', 'View', 'FullScreen'] as const;

export const isValidDashboardState = (state: unknown): boolean =>
  typeof state === 'string' && DASHBOARD_STATES.includes(state as typeof DASHBOARD_STATES[number]);

export const isConfirmedDashboardMode = (
  state: unknown,
  dashboardProbeSucceeded: boolean,
): boolean => isValidDashboardState(state) && dashboardProbeSucceeded;
