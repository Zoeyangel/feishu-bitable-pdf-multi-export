export interface DashboardDataRange {
  type: 'ALL' | 'VIEW';
  viewId?: string;
  viewName?: string;
}

export interface DashboardDataCondition {
  tableId: string;
  dataRange: DashboardDataRange;
  groups: never[];
  series: 'COUNTA';
}

export const buildFixedDashboardDataCondition = (
  tableId: string,
  dataRanges: DashboardDataRange[],
): DashboardDataCondition => {
  const targetView = dataRanges.find(range => range.type === 'VIEW' && range.viewName === '信息录入');
  if (!targetView?.viewId || !targetView.viewName) {
    throw new Error('未找到目标视图“信息录入”');
  }

  return {
    tableId,
    dataRange: {
      type: 'VIEW',
      viewId: targetView.viewId,
      viewName: targetView.viewName,
    },
    groups: [],
    series: 'COUNTA',
  };
};
