<template>
  <!-- 应用模式：配置状态（首次添加或编辑配置） -->
  <div v-if="isDashboard && isConfigMode" class="config-panel">
    <div class="config-header">
      <h1>PDF导出工具</h1>
      <p class="config-desc">配置 PDF 导出功能，用户选中记录后可导出为 PDF 文件</p>
    </div>
    <div class="config-content">
      <div class="config-item">
        <label>插件名称</label>
        <input v-model="configData.pluginName" type="text" placeholder="PDF导出工具" />
      </div>
      <div class="config-item">
        <label>默认模板</label>
        <select v-model="configData.defaultTemplate">
          <option value="default">默认模板</option>
          <option value="invoice">Invoice 模板</option>
        </select>
      </div>
    </div>
    <div class="config-footer">
      <button class="btn-cancel" @click="onCancel">取消</button>
      <button class="btn-confirm" @click="onConfirm">确认</button>
    </div>
  </div>

  <!-- 应用模式：查看状态 -->
  <template v-else-if="isDashboard && !isConfigMode">
    <!-- 紧凑触发按钮 -->
    <div v-if="!isExpanded" class="compact-trigger" @click="isExpanded = true">
      <span class="trigger-icon">📄</span>
      <span class="trigger-text">{{ configData.pluginName || 'PDF导出' }}</span>
      <span v-if="aggregatedOrder" class="trigger-badge">已选择</span>
    </div>

    <!-- 展开后的浮层面板 -->
    <template v-if="isExpanded">
      <div class="panel-overlay" @click="isExpanded = false"></div>
      <div class="floating-panel">
        <div class="panel-header">
          <h1>{{ configData.pluginName || 'PDF导出工具' }}</h1>
          <button class="btn-close" @click="isExpanded = false">✕</button>
        </div>
        <div class="panel-content">
          <!-- 应用模式：流水号搜索 -->
          <div class="search-section">
            <label>输入流水号查找记录</label>
            <div class="search-input-group">
              <input
                v-model="searchSerialNumber"
                type="text"
                placeholder="请输入流水号"
                @keyup.enter="searchBySerialNumber"
              />
              <button class="btn-search" @click="searchBySerialNumber">查找</button>
            </div>
            <p v-if="searchError" class="search-error">{{ searchError }}</p>
          </div>
          <!-- 主内容区（应用模式） -->
          <div class="main-content">
            <div v-if="loading" class="loading">加载中...</div>
            <div v-else-if="error" class="error">
              <p>{{ error }}</p>
              <button class="btn-retry" @click="init">重试</button>
            </div>
            <div v-else-if="!aggregatedOrder" class="hint">
              <p>请通过上方流水号搜索找到记录</p>
            </div>
            <template v-else>
              <FieldSelector :fields="fields" @update:fields="onFieldsUpdate" />
              <ExportPanel
                :templates="templates"
                :selectedTemplate="selectedTemplate"
                :disabled="selectedFields.length === 0 || !!templateError"
                :templateError="templateError"
                @update:template="onTemplateUpdate"
                @preview="onPreview"
                @download="onDownload"
              />
              <DataPreview
                :order="aggregatedOrder"
                :selectedFields="selectedFields"
                :selectedTemplate="selectedTemplate"
                :editedValues="editedValues"
                :invoiceNumber="currentInvoiceNumber"
                @update:editedValues="onEditedValuesUpdate"
              />
            </template>
          </div>
        </div>
      </div>
    </template>
  </template>

  <!-- 底表模式 -->
  <div v-else class="app sidebar">
    <div class="app-header">
      <h1>PDF导出工具</h1>
    </div>
    <!-- 主内容区（底表模式） -->
    <div class="main-content">
      <div v-if="loading" class="loading">加载中...</div>
      <div v-else-if="error" class="error">
        <p>{{ error }}</p>
        <button class="btn-retry" @click="init">重试</button>
      </div>
      <div v-else-if="!aggregatedOrder" class="hint">
        <p>请先在表格中选中一行记录</p>
      </div>
      <template v-else>
        <FieldSelector :fields="fields" @update:fields="onFieldsUpdate" />
        <ExportPanel
          :templates="templates"
          :selectedTemplate="selectedTemplate"
          :disabled="selectedFields.length === 0 || !!templateError"
          :templateError="templateError"
          @update:template="onTemplateUpdate"
          @preview="onPreview"
          @download="onDownload"
        />
        <DataPreview
          :order="aggregatedOrder"
          :selectedFields="selectedFields"
          :selectedTemplate="selectedTemplate"
          :editedValues="editedValues"
          :invoiceNumber="currentInvoiceNumber"
          @update:editedValues="onEditedValuesUpdate"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { bitable, DashboardState } from '@lark-base-open/js-sdk';
import FieldSelector from './components/FieldSelector.vue';
import DataPreview from './components/DataPreview.vue';
import ExportPanel from './components/ExportPanel.vue';
import { bitableService } from './services/bitableService';
import { pdfService } from './services/pdfService';
import { templates, getTemplateById } from './templates';
import { matchTemplateFields } from './utils/fieldMatcher';
import { matchesPiNumberFieldName } from './utils/piFieldMatcher';
import { isConfirmedDashboardMode } from './utils/runtimeMode';
import { buildFixedDashboardDataCondition } from './utils/dashboardDataCondition';
import { getSearchTableLookupStrategy, shouldValidateTargetView } from './utils/searchTableStrategy';
import { FieldType, type AggregatedOrder, type FieldMeta, type Selection, type InvoiceTableContext } from './types';

// 环境检测
const isDashboard = ref(false);
const isConfigMode = ref(false);
const isExpanded = ref(false);

// 插件配置
const configData = ref({
  pluginName: 'PDF导出工具',
  defaultTemplate: 'default',
});
// 缓存最近一次解析到的 customConfig，
// 避免在查看态调用仅配置态可用的 dashboard.getConfig()
const dashboardCustomConfig = ref<DashboardCustomConfig>({});

// 应用模式：流水号搜索
const searchSerialNumber = ref('');
const searchError = ref<string | null>(null);

const loading = ref(false);
const error = ref<string | null>(null);
const selection = ref<Selection | null>(null);
const fields = ref<FieldMeta[]>([]);
const aggregatedOrder = ref<AggregatedOrder | null>(null);
const selectedTemplate = ref('default');
const templateError = ref<string | null>(null);
const editedValues = ref<Record<string, string>>({});
const currentInvoiceNumber = ref<string>('');
const invoiceTableContext = ref<InvoiceTableContext | null>(null);

interface DashboardCustomConfig {
  pluginName?: string;
  defaultTemplate?: string;
}

const TARGET_TABLE_NAME = '发票制作';
const TARGET_VIEW_NAME = '信息录入';
const SERIAL_FIELD_KEYWORD = '所属询盘流水号';

let unsubscribe: (() => void) | null = null;

const selectedFields = computed(() =>
  fields.value.filter(f => f.selected)
);

const normalizeLookupText = (value: string): string =>
  value.trim().toLowerCase().replace(/[\s._\\/-]+/g, '');

const cloneFields = (sourceFields: FieldMeta[]): FieldMeta[] =>
  sourceFields.map(field => ({ ...field, selected: false }));

const matchesSerialField = (field: Pick<FieldMeta, 'name'>): boolean =>
  field.name === SERIAL_FIELD_KEYWORD || field.name.includes(SERIAL_FIELD_KEYWORD);

const matchesPiNumberField = (field: Pick<FieldMeta, 'name'>): boolean =>
  matchesPiNumberFieldName(field.name);

const matchesPiDateField = (field: Pick<FieldMeta, 'name'>): boolean => {
  if (field.name.includes('PI日期')) {
    return true;
  }

  const name = field.name.toLowerCase();
  return name.includes('pi') && name.includes('date');
};

const findSerialField = (availableFields: FieldMeta[] = fields.value): FieldMeta | undefined =>
  availableFields.find(matchesSerialField);

// ============ PI号相关函数 ============

const findPiNumberField = (availableFields: FieldMeta[] = fields.value): FieldMeta | undefined =>
  availableFields.find(matchesPiNumberField);

const findPiDateField = (availableFields: FieldMeta[] = fields.value): FieldMeta | undefined =>
  availableFields.find(matchesPiDateField);

/**
 * 从 onConfigChange 事件数据中提取 customConfig。
 * 兼容两种可能的数据结构：
 *   结构 A（标准）: { dataConditions: [...], customConfig: { pluginName, defaultTemplate, ... } }
 *   结构 B（扁平）: { pluginName, defaultTemplate, ... }  ← event.data 本身就是 customConfig
 */
const getDashboardCustomConfig = (
  config: unknown
): DashboardCustomConfig => {
  if (!config || typeof config !== 'object') return {};
  const c = config as Record<string, unknown>;

  const rawConfig = c.customConfig && typeof c.customConfig === 'object'
    ? c.customConfig as Record<string, unknown>
    : c;

  const result: DashboardCustomConfig = {};

  if (typeof rawConfig.pluginName === 'string') {
    result.pluginName = rawConfig.pluginName;
  }
  if (typeof rawConfig.defaultTemplate === 'string') {
    result.defaultTemplate = rawConfig.defaultTemplate;
  }

  return result;
};

const applyDashboardCustomConfig = (customConfig?: DashboardCustomConfig | null) => {
  const normalizedConfig: DashboardCustomConfig = {
    pluginName: customConfig?.pluginName || configData.value.pluginName || 'PDF导出工具',
    defaultTemplate: customConfig?.defaultTemplate || configData.value.defaultTemplate || 'default',
  };

  dashboardCustomConfig.value = normalizedConfig;
  configData.value = {
    pluginName: normalizedConfig.pluginName || 'PDF导出工具',
    defaultTemplate: normalizedConfig.defaultTemplate || 'default',
  };
  selectedTemplate.value = normalizedConfig.defaultTemplate || 'default';
};

const isTargetTableName = (tableName: string): boolean =>
  normalizeLookupText(tableName) === normalizeLookupText(TARGET_TABLE_NAME);

const loadTableFields = async (tableId: string): Promise<FieldMeta[]> => {
  const tableFields = await bitableService.getFieldList(tableId);
  return cloneFields(tableFields);
};

const setFieldsForCurrentTable = (tableFields: FieldMeta[]) => {
  fields.value = cloneFields(tableFields);
  applyTemplateFieldSelection();
};

const buildFixedDashboardConfig = async (customConfig: DashboardCustomConfig) => {
  const targetTable = await bitable.base.getTableByName(TARGET_TABLE_NAME);
  const dataRanges = await bitable.dashboard.getTableDataRange(targetTable.id);
  const fixedDataCondition = buildFixedDashboardDataCondition(targetTable.id, dataRanges as Array<{
    type: 'ALL' | 'VIEW';
    viewId?: string;
    viewName?: string;
  }>);

  return {
    dataConditions: [fixedDataCondition],
    customConfig,
  };
};

const buildInvoiceTableContext = (
  tableId: string,
  tableName: string,
  tableFields: FieldMeta[],
  source: InvoiceTableContext['source']
): InvoiceTableContext => {
  const serialField = findSerialField(tableFields);
  if (!serialField) {
    throw new Error(`数据表中未找到"${SERIAL_FIELD_KEYWORD}"字段`);
  }

  return {
    tableId,
    tableName,
    fields: tableFields,
    serialField,
    piNumberField: findPiNumberField(tableFields),
    piDateField: findPiDateField(tableFields),
    source,
  };
};

const inspectTableContext = async (
  tableMeta: { id: string; name: string },
  source: InvoiceTableContext['source']
): Promise<InvoiceTableContext | null> => {
  console.log('[App] inspectTableContext 开始:', {
    tableId: tableMeta.id,
    tableName: tableMeta.name,
    source,
  });

  const table = await bitable.base.getTableById(tableMeta.id);
  console.log('[App] inspectTableContext getTableById 成功:', {
    tableId: tableMeta.id,
    tableName: tableMeta.name,
  });

  if (shouldValidateTargetView(isDashboard.value)) {
    const viewMetaList = await table.getViewMetaList();
    console.log('[App] inspectTableContext getViewMetaList 成功:', {
      tableId: tableMeta.id,
      tableName: tableMeta.name,
      viewCount: viewMetaList.length,
    });

    const targetView = viewMetaList.find(view =>
      normalizeLookupText(view.name) === normalizeLookupText(TARGET_VIEW_NAME)
    );

    console.log('[App] 检查目标表候选:', {
      tableId: tableMeta.id,
      tableName: tableMeta.name,
      source,
      viewCount: viewMetaList.length,
      targetViewId: targetView?.id,
      targetViewName: targetView?.name,
    });

    if (!targetView) {
      return null;
    }
  } else {
    console.log('[App] inspectTableContext 跳过视图校验:', {
      tableId: tableMeta.id,
      tableName: tableMeta.name,
      reason: 'dashboard-mode',
    });
  }

  const tableFields = await loadTableFields(tableMeta.id);
  console.log('[App] inspectTableContext loadTableFields 成功:', {
    tableId: tableMeta.id,
    tableName: tableMeta.name,
    fieldCount: tableFields.length,
  });

  const serialField = findSerialField(tableFields);

  console.log('[App] 检查目标表字段结果:', {
    tableId: tableMeta.id,
    tableName: tableMeta.name,
    hasSerialField: !!serialField,
  });

  if (!serialField) {
    throw new Error(`目标表“${TARGET_TABLE_NAME}”中未找到“${SERIAL_FIELD_KEYWORD}”字段`);
  }

  return buildInvoiceTableContext(tableMeta.id, tableMeta.name, tableFields, source);
};

// 始终按固定表“发票制作”与固定视图“信息录入”定位查询目标。
const resolveSearchTableContext = async (): Promise<InvoiceTableContext> => {
  console.log('[App] resolveSearchTableContext 开始');

  const lookupStrategy = getSearchTableLookupStrategy(isDashboard.value);
  console.log('[App] resolveSearchTableContext lookupStrategy:', lookupStrategy);

  if (lookupStrategy === 'direct-table-name') {
    const targetTable = await bitable.base.getTableByName(TARGET_TABLE_NAME);
    console.log('[App] resolveSearchTableContext getTableByName 成功:', {
      targetTableName: TARGET_TABLE_NAME,
    });

    const targetTableId = targetTable.id;
    console.log('[App] resolveSearchTableContext direct table id:', {
      targetTableId,
      targetTableName: TARGET_TABLE_NAME,
    });

    const resolved = await inspectTableContext({
      id: targetTableId,
      name: TARGET_TABLE_NAME,
    }, 'target-name');

    if (resolved) {
      return resolved;
    }

    throw new Error(`目标表“${TARGET_TABLE_NAME}”中未找到视图“${TARGET_VIEW_NAME}”`);
  }

  const tableMetaList = await bitable.base.getTableMetaList();
  console.log('[App] resolveSearchTableContext getTableMetaList 成功:', {
    tableCount: tableMetaList?.length ?? 0,
    tableNames: (tableMetaList ?? []).map(tableMeta => tableMeta.name),
  });

  if (!tableMetaList || tableMetaList.length === 0) {
    throw new Error('未找到任何数据表，请检查插件所在多维表格');
  }

  const targetTable = tableMetaList.find(tableMeta => isTargetTableName(tableMeta.name));
  console.log('[App] resolveSearchTableContext 目标表匹配结果:', {
    targetTableId: targetTable?.id,
    targetTableName: targetTable?.name,
  });

  if (!targetTable) {
    throw new Error(`未找到目标表“${TARGET_TABLE_NAME}”`);
  }

  const resolved = await inspectTableContext(targetTable, 'target-name');
  if (resolved) {
    return resolved;
  }

  throw new Error(`目标表“${TARGET_TABLE_NAME}”中未找到视图“${TARGET_VIEW_NAME}”`);
};

const getPiDateWriteValue = (dateField: FieldMeta): string | number => {
  const now = new Date();
  const dateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (dateField.type === FieldType.DateTime) {
    const timestamp = dateOnly.getTime();
    console.log('[App] PI日期字段为 DateTime，写入时间戳:', timestamp);
    return timestamp;
  }

  const dateStr = `${dateOnly.getFullYear()}-${String(dateOnly.getMonth() + 1).padStart(2, '0')}-${String(dateOnly.getDate()).padStart(2, '0')}`;
  console.log('[App] PI日期字段为非 DateTime，写入字符串:', dateStr);
  return dateStr;
};

const extractInvoiceNumber = (value: string): number | null => {
  if (!value) return null;
  const match = value.trim().match(/AG-(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
};

const generateNextInvoiceNumber = async (
  context: InvoiceTableContext
): Promise<string> => {
  const piField = context.piNumberField;
  console.log('[App] generateNextInvoiceNumber 开始:', {
    tableId: context.tableId,
    tableName: context.tableName,
    piFieldId: piField?.id,
    piFieldName: piField?.name,
  });

  if (!piField) {
    console.warn('[App] 未识别到 PI号字段，回退为 AG-001');
    return 'AG-001';
  }

  const allValues = await bitableService.getAllFieldValues(context.tableId, piField.id);
  console.log('[App] generateNextInvoiceNumber 历史PI号扫描结果:', {
    tableId: context.tableId,
    tableName: context.tableName,
    piFieldId: piField.id,
    piFieldName: piField.name,
    totalValueCount: allValues.length,
    sampleValues: allValues.slice(0, 20),
  });

  let maxNumber = 0;
  for (const value of allValues) {
    const num = extractInvoiceNumber(value);
    console.log('[App] 解析历史PI号:', {
      rawValue: value,
      parsedNumber: num,
    });
    if (num !== null && num > maxNumber) maxNumber = num;
  }

  const nextValue = `AG-${String(maxNumber + 1).padStart(3, '0')}`;
  console.log('[App] generateNextInvoiceNumber 结果:', {
    maxNumber,
    nextValue,
  });
  return nextValue;
};

const getOrGenerateInvoiceNumber = async (
  context: InvoiceTableContext
): Promise<string> => {
  if (!aggregatedOrder.value) return 'AG-001';

  const piField = context.piNumberField;
  console.log('[App] getOrGenerateInvoiceNumber 开始:', {
    tableId: context.tableId,
    tableName: context.tableName,
    sourceRecordIds: aggregatedOrder.value.sourceRecordIds,
    piFieldId: piField?.id,
    piFieldName: piField?.name,
  });

  if (!piField) {
    const nextValue = await generateNextInvoiceNumber(context);
    currentInvoiceNumber.value = nextValue;
    return nextValue;
  }

  for (const recordId of aggregatedOrder.value.sourceRecordIds) {
    const currentValue = await bitableService.getCellValue(
      context.tableId,
      piField.id,
      recordId,
    );
    console.log('[App] 检查当前订单已有PI号:', {
      recordId,
      currentValue,
    });
    if (currentValue.trim()) {
      currentInvoiceNumber.value = currentValue.trim();
      console.log('[App] 复用已有PI号:', {
        recordId,
        invoiceNumber: currentValue.trim(),
      });
      return currentValue.trim();
    }
  }

  const nextValue = await generateNextInvoiceNumber(context);
  currentInvoiceNumber.value = nextValue;
  return nextValue;
};

const writeBackInvoiceNumber = async (
  context: InvoiceTableContext,
  invoiceNumber: string
): Promise<void> => {
  console.log('[App] writeBackInvoiceNumber 开始, invoiceNumber:', invoiceNumber);
  console.log('[App] selection.value:', selection.value);
  console.log('[App] aggregatedOrder.value:', aggregatedOrder.value);

  if (!aggregatedOrder.value) {
    console.warn('[App] aggregatedOrder 为空，跳过写回');
    return;
  }

  const sourceRecordIds = aggregatedOrder.value.sourceRecordIds;
  const piField = context.piNumberField;
  const dateField = context.piDateField;

  if (sourceRecordIds.length === 0) {
    console.warn('[App] sourceRecordIds 为空，跳过写回');
    return;
  }

  for (const recordId of sourceRecordIds) {
    console.log('[App] 处理记录:', recordId);

    console.log('[App] PI号字段:', piField);
    if (piField) {
      const currentValue = await bitableService.getCellValue(
        context.tableId,
        piField.id,
        recordId
      );
      console.log('[App] 当前PI号值:', currentValue);

      if (!currentValue || !currentValue.trim()) {
        console.log('[App] 写入PI号:', invoiceNumber);
        await bitableService.setCellValue(
          context.tableId,
          piField.id,
          recordId,
          invoiceNumber
        );
      } else {
        console.log('[App] PI号已有值，跳过写入');
      }
    }

    console.log('[App] PI日期字段:', dateField);
    if (dateField) {
      const dateValue = getPiDateWriteValue(dateField);
      const currentDate = await bitableService.getCellValue(
        context.tableId,
        dateField.id,
        recordId
      );
      console.log('[App] 当前PI日期值:', currentDate);

      if (!currentDate || !currentDate.trim()) {
        console.log('[App] 写入PI日期:', dateValue);
        await bitableService.setCellValue(
          context.tableId,
          dateField.id,
          recordId,
          dateValue
        );
      } else {
        console.log('[App] PI日期已有值，跳过写入');
      }
    }
  }
};

const onFieldsUpdate = (updated: FieldMeta[]) => {
  fields.value = updated;
};

const onEditedValuesUpdate = (updated: Record<string, string>) => {
  editedValues.value = updated;
};

const onTemplateUpdate = (templateId: string) => {
  selectedTemplate.value = templateId;
};

// 根据流水号加载聚合订单
const loadOrderBySerialNo = async (
  context: InvoiceTableContext,
  serialNo: string
) => {
  const fieldIds = context.fields.map(field => field.id);
  console.log('[App] loadOrderBySerialNo 开始:', {
    tableId: context.tableId,
    tableName: context.tableName,
    source: context.source,
    serialFieldId: context.serialField.id,
    serialFieldName: context.serialField.name,
    serialNo,
    fieldCount: context.fields.length,
  });

  const records = await bitableService.getRecordsBySerialNo(
    context.tableId,
    serialNo,
    fieldIds,
    context.fields,
  );

  console.log('[App] loadOrderBySerialNo 查询结果:', {
    tableId: context.tableId,
    serialNo,
    recordCount: records.length,
    recordIds: records.map(record => record.recordId),
  });

  if (records.length === 0) {
    throw new Error(`未找到流水号为 "${serialNo}" 的记录`);
  }

  // 聚合订单
  aggregatedOrder.value = bitableService.aggregateOrder(records);

  // 初始化编辑值
  editedValues.value = {};
  for (const [key, value] of Object.entries(aggregatedOrder.value.header)) {
    if (value) editedValues.value[key] = value;
  }
  // 确保字段名映射正确
  const header = aggregatedOrder.value.header as Record<string, string>;
  if (header['PO number']) editedValues.value['poNumber'] = header['PO number'];
  if (header['Shipping method']) editedValues.value['shippingMethod'] = header['Shipping method'];
  if (header['Firm']) editedValues.value['firm'] = header['Firm'];

  // 检查冲突
  if (aggregatedOrder.value.conflicts && aggregatedOrder.value.conflicts.length > 0) {
    console.warn('[App] 字段冲突:', aggregatedOrder.value.conflicts);
  }
};

const getSerialNumberFromSelectionTrigger = async (
  triggerSelection: Selection
): Promise<string> => {
  console.log('[App] 底表点击触发开始:', {
    triggerTableId: triggerSelection.tableId,
    triggerViewId: triggerSelection.viewId,
    triggerRecordId: triggerSelection.recordId,
  });

  const triggerTableFields = await bitableService.getFieldList(triggerSelection.tableId);
  const triggerSerialField = findSerialField(triggerTableFields);

  console.log('[App] 底表字段检查结果:', {
    triggerTableId: triggerSelection.tableId,
    fieldCount: triggerTableFields.length,
    triggerSerialFieldId: triggerSerialField?.id,
    triggerSerialFieldName: triggerSerialField?.name,
  });

  if (!triggerSerialField) {
    throw new Error(`当前底表未找到"${SERIAL_FIELD_KEYWORD}"字段`);
  }

  const serialNo = await bitableService.getCellValue(
    triggerSelection.tableId,
    triggerSerialField.id,
    triggerSelection.recordId!,
  );

  console.log('[App] 底表点击提取流水号结果:', {
    triggerTableId: triggerSelection.tableId,
    triggerRecordId: triggerSelection.recordId,
    triggerSerialFieldId: triggerSerialField.id,
    triggerSerialFieldName: triggerSerialField.name,
    rawSerialNo: serialNo,
    trimmedSerialNo: serialNo.trim(),
  });

  if (!serialNo.trim()) {
    throw new Error(`选中记录的"${SERIAL_FIELD_KEYWORD}"为空`);
  }

  return serialNo.trim();
};


const handleSelectionTrigger = async (triggerSelection: Selection) => {
  const serialNo = await getSerialNumberFromSelectionTrigger(triggerSelection);
  const resolved = await resolveSearchTableContext();

  invoiceTableContext.value = resolved;
  setFieldsForCurrentTable(resolved.fields);
  currentInvoiceNumber.value = '';

  await loadOrderBySerialNo(resolved, serialNo);
};

// 应用模式：通过流水号搜索记录
const searchBySerialNumber = async () => {
  searchError.value = null;
  const serialNum = searchSerialNumber.value.trim();
  if (!serialNum) {
    searchError.value = '请输入流水号';
    return;
  }

  console.log('[App] 搜索流水号:', serialNum);
  loading.value = true;

  try {
    console.log('[App] searchBySerialNumber: 开始 resolveSearchTableContext');
    const resolved = await resolveSearchTableContext();
    console.log('[App] searchBySerialNumber: resolveSearchTableContext 完成');
    const serialField = findSerialField(resolved.fields);

    console.log('[App] 搜索表定位结果:', {
      tableName: resolved.tableName,
      tableId: resolved.tableId,
      source: resolved.source,
      hasSerialField: !!serialField,
    });

    setFieldsForCurrentTable(resolved.fields);
    invoiceTableContext.value = resolved;
    currentInvoiceNumber.value = '';

    console.log('[App] searchBySerialNumber: 开始 loadOrderBySerialNo');
    await loadOrderBySerialNo(resolved, serialNum);
    console.log('[App] searchBySerialNumber: loadOrderBySerialNo 完成');

  } catch (e) {
    console.error('[App] 搜索失败:', e);
    searchError.value = '搜索失败: ' + (e as Error).message;
  } finally {
    loading.value = false;
  }
};

const onPreview = async () => {
  const template = getTemplateById(selectedTemplate.value);
  if (!template || !aggregatedOrder.value) return;

  try {
    let invoiceNumber: string | undefined;
    if (template.id === 'invoice') {
      if (!invoiceTableContext.value) {
        throw new Error('未找到发票数据表上下文');
      }
      invoiceNumber = await getOrGenerateInvoiceNumber(invoiceTableContext.value);
    }
    await pdfService.preview(template, aggregatedOrder.value, editedValues.value, invoiceNumber);
  } catch (e) {
    error.value = 'PDF预览失败，请重试';
  }
};

const onDownload = async () => {
  const template = getTemplateById(selectedTemplate.value);
  if (!template || !aggregatedOrder.value) return;

  try {
    let invoiceNumber: string | undefined;
    if (template.id === 'invoice') {
      if (!invoiceTableContext.value) {
        throw new Error('未找到发票数据表上下文');
      }
      invoiceNumber = currentInvoiceNumber.value || await getOrGenerateInvoiceNumber(invoiceTableContext.value);
    }

    const filename = invoiceNumber
      ? `Invoice_${invoiceNumber}.pdf`
      : `export_${Date.now()}.pdf`;

    await pdfService.download(template, aggregatedOrder.value, filename, editedValues.value, invoiceNumber);

    if (template.id === 'invoice' && invoiceNumber) {
      console.log('[App] 开始写回 PI号和PI日期:', invoiceNumber);
      await writeBackInvoiceNumber(invoiceTableContext.value!, invoiceNumber);
      console.log('[App] 写回完成');
    }
  } catch (e) {
    console.error('[App] PDF下载失败:', e);
    error.value = 'PDF下载失败，请重试';
  }
};

const applyTemplateFieldSelection = () => {
  const template = getTemplateById(selectedTemplate.value);
  templateError.value = null;

  if (!template?.fields?.required) {
    fields.value = fields.value.map(f => ({ ...f, selected: true }));
    return;
  }

  const result = matchTemplateFields(
    template.fields.required,
    template.fields.optional || [],
    fields.value
  );

  if (result.missingFields.length > 0) {
    templateError.value = `缺少必选字段：${result.missingFields.join('、')}`;
    fields.value = fields.value.map(f => ({ ...f, selected: false }));
    return;
  }

  fields.value = fields.value.map(f => ({
    ...f,
    selected: result.matchedIds.includes(f.id),
  }));
};

// 应用模式：配置确认
const onConfirm = async () => {
  console.log('[App] onConfirm 开始执行...');
  try {
    const nextCustomConfig: DashboardCustomConfig = {
      pluginName: configData.value.pluginName,
      defaultTemplate: configData.value.defaultTemplate,
    };

    const configToSave = await buildFixedDashboardConfig(nextCustomConfig);
    console.log('[App] 保存配置:', JSON.stringify(configToSave, null, 2));

    const saveResult = await bitable.dashboard.saveConfig(configToSave as any);
    console.log('[App] saveConfig 结果:', saveResult);
    applyDashboardCustomConfig(nextCustomConfig);
  } catch (e) {
    console.error('[App] 保存配置失败:', e);
    alert('保存配置失败: ' + (e as Error).message);
  }
};

// 应用模式：取消配置
const onCancel = () => {
  // 取消时什么都不做，宿主会自行处理关闭
};

watch(selectedTemplate, () => {
  currentInvoiceNumber.value = '';
  applyTemplateFieldSelection();
});

watch(selectedFields, () => {
  currentInvoiceNumber.value = '';
}, { deep: true });

const init = async () => {
  error.value = null;
  selection.value = null;
  fields.value = [];
  aggregatedOrder.value = null;

  // 第一步：立即注册 onSelectionChange，不等模式检测，确保用户点击行不丢失
  // 用 isSidebarMode 标志位控制：检测完成前缓存事件，检测后决定是否处理
  let pendingSelection: Selection | null = null;
  let modeResolved = false;

  unsubscribe = bitableService.onSelectionChange(async (newSelection) => {
    console.log('[App] onSelectionChange 回调:', newSelection);

    if (modeResolved && isDashboard.value) {
      // 应用模式下不处理行选中事件
      return;
    }

    if (!modeResolved) {
      // 模式还未确定时，先缓存最新选中状态
      pendingSelection = newSelection;
      return;
    }

    // 底表模式：处理选中变化
    await handleSelectionChange(newSelection);
  });

  // 第二步：异步检测模式（getConfig 可能有延迟）
  const dashboardState = (() => {
    try {
      return bitable.dashboard?.state;
    } catch {
      return undefined;
    }
  })();
  console.log('[App] dashboard state 初始探测:', dashboardState);

  const currentSelection = pendingSelection ?? await bitableService.getSelection();
  console.log('[App] 当前选中探测:', currentSelection);

  if (currentSelection?.recordId) {
    isDashboard.value = false;
    isConfigMode.value = false;
    modeResolved = true;
    console.log('[App] 运行模式确认: 底表模式（检测到 record 级选中）');

    await handleSelectionChange(currentSelection);
    return;
  }

  console.log('[App] 运行模式: 等待宿主确认');

  if (dashboardState) {
    // ===== 应用模式初始化 =====
    // 注意：底表插件里 state 也可能返回合法值。
    // 只有 dashboard 专属 API 真正调用成功后，才切换到应用模式。
    let dashboardApiWorks = false;
    try {
      const state = bitable.dashboard.state;
      console.log('[App] Dashboard 状态:', state);
      const isCreate = state === DashboardState.Create;
      const isConfigState = state === DashboardState.Config || isCreate;

      const confirmDashboardMode = () => {
        isDashboard.value = isConfirmedDashboardMode(state, dashboardApiWorks);
        modeResolved = true;
        console.log('[App] 运行模式确认:', isDashboard.value ? '应用模式' : '底表模式');

        if (isDashboard.value && unsubscribe) {
          unsubscribe();
          unsubscribe = null;
        }
      };

      const bindDashboardConfigChange = () => {
        bitable.dashboard.onConfigChange(async (event) => {
          console.log('[App] 配置变化事件:', event.data);
          const eventConfig = getDashboardCustomConfig(event.data);
          const nextConfig: DashboardCustomConfig = {
            pluginName: eventConfig.pluginName || dashboardCustomConfig.value.pluginName || configData.value.pluginName,
            defaultTemplate: eventConfig.defaultTemplate || dashboardCustomConfig.value.defaultTemplate || configData.value.defaultTemplate,
          };
          applyDashboardCustomConfig(nextConfig);
        });
      };

      if (isCreate) {
        dashboardApiWorks = true;
        isConfigMode.value = true;
        confirmDashboardMode();
        bindDashboardConfigChange();
        console.log('[App] Create 模式');
        return;
      }

      if (isConfigState) {
        console.log('[App] Config 模式');
        const config = await bitable.dashboard.getConfig();
        dashboardApiWorks = true;
        isConfigMode.value = true;
        confirmDashboardMode();
        bindDashboardConfigChange();
        applyDashboardCustomConfig(getDashboardCustomConfig(config));
        return;
      }

      // View / FullScreen：只有 setRendered 真正成功后，才确认是 dashboard。
      await bitable.dashboard.setRendered();
      dashboardApiWorks = true;
      isConfigMode.value = false;
      confirmDashboardMode();

      try {
        const fixedDashboardConfig = await buildFixedDashboardConfig({
          pluginName: dashboardCustomConfig.value.pluginName || configData.value.pluginName,
          defaultTemplate: dashboardCustomConfig.value.defaultTemplate || configData.value.defaultTemplate,
        });
        console.log('[App] 自动补齐固定 dataConditions:', fixedDashboardConfig);
        await bitable.dashboard.saveConfig(fixedDashboardConfig as any);
      } catch (e) {
        console.warn('[App] 自动补齐 fixed dataConditions 失败:', e);
      }
      return;

    } catch (e) {
      console.warn('[App] dashboard API 调用失败，回退到底表模式:', e);
      isDashboard.value = false;
      isConfigMode.value = false;
      modeResolved = true;
      console.log('[App] 运行模式确认: 底表模式');
    }

    // 若 dashboard API 验证失败，继续往下走底表模式初始化流程
    if (dashboardApiWorks) return;
  }

  isDashboard.value = false;
  isConfigMode.value = false;
  modeResolved = true;
  console.log('[App] 运行模式确认: 底表模式');

  // ===== 底表模式初始化 =====
  // 检测期间若有缓存的点击事件，直接使用；否则使用前面已经探测过的当前选中状态
  const initialSelection = currentSelection;

  if (initialSelection) {
    await handleSelectionChange(initialSelection);
  }
};

// 底表模式：处理选中行变化
const handleSelectionChange = async (newSelection: Selection | null) => {
  if (!newSelection?.recordId) {
    selection.value = null;
    fields.value = [];
    aggregatedOrder.value = null;
    invoiceTableContext.value = null;
    currentInvoiceNumber.value = '';
    return;
  }

  selection.value = newSelection;
  loading.value = true;

  try {
    await handleSelectionTrigger(newSelection);
  } catch (e) {
    console.error('[App] 处理底表点击触发失败:', e);
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
};

onMounted(init);

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe();
  }
});
</script>

<style scoped>
/* 底表模式样式 */
.app.sidebar {
  max-width: 400px;
  margin: 0 auto;
}

.main-content {
  padding: 0;
}

.app-header {
  text-align: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e0e0e0;
}

.app-header h1 {
  font-size: 20px;
  font-weight: 600;
  color: #333333;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #999999;
}

.error {
  text-align: center;
  padding: 20px;
  color: #f56c6c;
}

.hint {
  text-align: center;
  padding: 40px 20px;
  color: #999999;
  font-size: 14px;
}

.btn-retry {
  margin-top: 12px;
  padding: 8px 16px;
  background-color: #3370ff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-retry:hover {
  background-color: #2860e1;
}

/* 配置面板 */
.config-panel {
  padding: 24px;
  max-width: 480px;
  margin: 0 auto;
}

.config-header {
  margin-bottom: 24px;
  text-align: center;
}

.config-header h1 {
  font-size: 20px;
  font-weight: 600;
  color: #333333;
  margin-bottom: 8px;
}

.config-desc {
  font-size: 14px;
  color: #666666;
}

.config-content {
  margin-bottom: 24px;
}

.config-item {
  margin-bottom: 16px;
}

.config-item label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #333333;
  margin-bottom: 8px;
}

.config-item input,
.config-item select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
  color: #333333;
  background: white;
}

.config-item input:focus,
.config-item select:focus {
  outline: none;
  border-color: #3370ff;
}

.config-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid #e0e0e0;
}

.btn-cancel {
  padding: 10px 20px;
  background: white;
  color: #666666;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.btn-cancel:hover {
  background: #f5f5f5;
}

.btn-confirm {
  padding: 10px 20px;
  background: #3370ff;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.btn-confirm:hover {
  background: #2860e1;
}

/* 应用模式：紧凑触发按钮 */
.compact-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: #3370ff;
  color: white;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(51, 112, 255, 0.3);
  transition: all 0.2s ease;
}

.compact-trigger:hover {
  background: #2860e1;
  box-shadow: 0 4px 12px rgba(51, 112, 255, 0.4);
}

.trigger-icon {
  font-size: 16px;
}

.trigger-text {
  font-size: 14px;
}

.trigger-badge {
  background: rgba(255, 255, 255, 0.2);
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
}

/* 应用模式：浮层面板 */
.panel-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 999;
}

.floating-panel {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 420px;
  max-width: 90vw;
  max-height: 85vh;
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e0e0e0;
  background: #fafafa;
}

.panel-header h1 {
  font-size: 18px;
  font-weight: 600;
  color: #333333;
  margin: 0;
}

.btn-close {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  font-size: 18px;
  color: #999999;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-close:hover {
  background: #f0f0f0;
  color: #333333;
}

.panel-content {
  flex: 1;
  overflow: auto;
  padding: 16px;
}

/* 搜索区域 */
.search-section {
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e0e0e0;
}

.search-section label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #333333;
  margin-bottom: 8px;
}

.search-input-group {
  display: flex;
  gap: 8px;
}

.search-input-group input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
  color: #333333;
}

.search-input-group input:focus {
  outline: none;
  border-color: #3370ff;
}

.btn-search {
  padding: 10px 16px;
  background: #3370ff;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.btn-search:hover {
  background: #2860e1;
}

.search-error {
  margin-top: 8px;
  font-size: 13px;
  color: #f56c6c;
}
</style>
