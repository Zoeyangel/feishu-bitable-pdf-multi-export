export type SearchTableLookupStrategy = 'direct-table-name' | 'scan-table-list';

export const getSearchTableLookupStrategy = (isDashboardMode: boolean): SearchTableLookupStrategy =>
  isDashboardMode ? 'direct-table-name' : 'scan-table-list';

export const shouldValidateTargetView = (isDashboardMode: boolean): boolean => !isDashboardMode;
