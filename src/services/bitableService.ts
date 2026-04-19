import { bitable } from '@lark-base-open/js-sdk';
import type { FieldMeta, RecordData, Selection, FieldType, AggregatedOrder, OrderHeader, OrderItem, FieldConflict } from '../types';
import { findSerialFieldInList, matchesSerialFieldName } from '../utils/serialFieldMatcher';

// 商品级字段名列表
const ITEM_FIELDS = ['PRODUCTS', 'QTY', 'UNIT PRICE', 'Amount', 'Description(颜色/印刷等)'];
const KNOWN_FIELD_NAMES = [
  '所属询盘流水号',
  '流水号',
  'PI号',
  'PI日期',
  'PO number',
  'Bill to',
  'Ship to',
  'PRODUCTS',
  'QTY',
  'UNIT PRICE',
  'Amount',
  'Description(颜色/印刷等)',
  'Subtotal',
  'Total',
  'Shipping Cost',
  'In-hand Date',
  'Firm',
  'Shipping method',
  'Setup QTY',
  'Setup Charge',
  'AMOUNT 2',
];

class BitableService {
  /**
   * 获取当前选中信息
   */
  async getSelection(): Promise<Selection | null> {
    try {
      console.log('[bitableService] 正在获取选中信息...');
      const selection = await bitable.base.getSelection();
      console.log('[bitableService] 选中信息:', selection);

      if (!selection) {
        console.log('[bitableService] selection 为空');
        return null;
      }

      if (!selection.recordId) {
        console.log('[bitableService] recordId 为空，当前可能未选中记录');
        return null;
      }

      return {
        tableId: selection.tableId!,
        viewId: selection.viewId!,
        recordId: selection.recordId,
      };
    } catch (error) {
      console.error('[bitableService] 获取选中信息失败:', error);
      return null;
    }
  }

  /**
   * 监听选中变化
   */
  onSelectionChange(callback: (selection: Selection | null) => void): () => void {
    console.log('[bitableService] 注册选中变化监听...');
    return bitable.base.onSelectionChange((e) => {
      console.log('[bitableService] 选中变化:', e.data);
      const selection = e.data;
      if (selection && selection.recordId) {
        callback({
          tableId: selection.tableId!,
          viewId: selection.viewId!,
          recordId: selection.recordId,
        });
      } else {
        callback(null);
      }
    });
  }

  /**
   * 从已经通过宿主授权的 ITable 实例读字段列表。
   *
   * 背景：在 dashboard View 模式下，`bitable.base.getTableById(id)` 返回的 table
   * 是"未经宿主确认的代理"，调 `getFieldMetaList()` 会报 `table permission denied error`。
   * 而 `bitable.base.getTableByName(name)` 返回的 table 实例是经宿主异步校验过的，
   * 可以直接调 `getFieldMetaList()`。所以只要外层用 getTableByName 拿到 table，
   * 就应当把这个实例传进来，避免再被 id 路径覆盖掉。
   */
  async getFieldListFromTable(table: any, debugLabel = 'unknown'): Promise<FieldMeta[]> {
    try {
      const fieldMetaList = await table.getFieldMetaList();
      console.log('[bitableService] getFieldListFromTable getFieldMetaList 成功:', {
        debugLabel,
        fieldCount: fieldMetaList.length,
      });

      return fieldMetaList.map((field: any) => ({
        id: field.id,
        name: field.name,
        type: field.type as unknown as FieldType,
        selected: false,
      }));
    } catch (metaError) {
      console.warn('[bitableService] getFieldListFromTable getFieldMetaList 失败，尝试 table.getFieldList:', metaError);
      try {
        const fieldList = await table.getFieldList();
        const fallbackFields: FieldMeta[] = await Promise.all(fieldList.map(async (field: any) => ({
          id: field.id,
          name: await field.getName(),
          type: await field.getType() as unknown as FieldType,
          selected: false,
        })));

        console.log('[bitableService] getFieldListFromTable table.getFieldList 成功:', {
          debugLabel,
          fieldCount: fallbackFields.length,
        });

        return fallbackFields;
      } catch (fieldListError) {
        console.error('[bitableService] getFieldListFromTable 两种读取均失败:', {
          debugLabel,
          metaError,
          fieldListError,
        });
        return [];
      }
    }
  }

  /**
   * 获取表格字段列表
   */
  async getFieldList(tableId: string): Promise<FieldMeta[]> {
    try {
      const table = await bitable.base.getTableById(tableId);

      try {
        const fieldMetaList = await table.getFieldMetaList();
        console.log('[bitableService] getFieldList 使用 getFieldMetaList 成功:', {
          tableId,
          fieldCount: fieldMetaList.length,
        });

        return fieldMetaList.map(field => ({
          id: field.id,
          name: field.name,
          type: field.type as unknown as FieldType,
          selected: false,
        }));
      } catch (metaError) {
        console.warn('[bitableService] getFieldMetaList 失败，回退 getFieldList:', metaError);
        try {
          const fieldList = await table.getFieldList();
          const fallbackFields = await Promise.all(fieldList.map(async (field) => ({
            id: field.id,
            name: await field.getName(),
            type: await field.getType() as unknown as FieldType,
            selected: false,
          })));

          console.log('[bitableService] getFieldList 使用 table.getFieldList 成功:', {
            tableId,
            fieldCount: fallbackFields.length,
          });

          return fallbackFields;
        } catch (fieldListError) {
          console.warn('[bitableService] table.getFieldList 失败，回退已知字段探测:', fieldListError);
          const knownFields = await this.getKnownFieldsByName(tableId);
          if (knownFields.length > 0) {
            return knownFields;
          }
          throw fieldListError;
        }
      }
    } catch (error) {
      console.error('获取字段列表失败:', error);
      return [];
    }
  }

  private async getKnownFieldsByName(tableId: string): Promise<FieldMeta[]> {
    const table = await bitable.base.getTableById(tableId);
    const resolvedFields: FieldMeta[] = [];
    const missedFieldNames: string[] = [];

    for (const fieldName of KNOWN_FIELD_NAMES) {
      try {
        const field = await table.getField(fieldName);
        const resolvedName = await field.getName();

        if (resolvedFields.some(existingField => existingField.id === field.id)) {
          continue;
        }

        resolvedFields.push({
          id: field.id,
          name: resolvedName,
          type: await field.getType() as unknown as FieldType,
          selected: false,
        });
      } catch {
        missedFieldNames.push(fieldName);
      }
    }

    console.log('[bitableService] 已知字段探测结果:', {
      tableId,
      fieldCount: resolvedFields.length,
      fieldNames: resolvedFields.map(field => field.name),
      missedFieldNames,
    });

    return resolvedFields;
  }

  /**
   * 获取单个单元格的值
   */
  async getCellValue(tableId: string, fieldId: string, recordId: string): Promise<string> {
    try {
      const table = await bitable.base.getTableById(tableId);
      const value = await table.getCellString(fieldId, recordId);
      console.log(`[bitableService] getCellValue: tableId=${tableId}, fieldId=${fieldId}, recordId=${recordId}, value="${value}"`);
      return value || '';
    } catch (error) {
      console.error('[bitableService] 获取单元格值失败:', error);
      return '';
    }
  }

  /**
   * 【核心】按流水号查询所有相关记录
   * 返回同一流水号下的所有记录数据
   */
  async getRecordsBySerialNo(
    tableId: string,
    serialNo: string,
    fieldIds: string[],
    knownFields?: FieldMeta[]
  ): Promise<RecordData[]> {
    try {
      console.log('[bitableService] getRecordsBySerialNo 开始, tableId:', tableId, 'serialNo:', serialNo);
      const table = await bitable.base.getTableById(tableId);
      const availableFields = knownFields && knownFields.length > 0
        ? knownFields
        : await this.getFieldList(tableId);

      // 找到流水号字段
      const serialField = findSerialFieldInList(availableFields);
      if (!serialField) {
        console.error('[bitableService] 未找到流水号字段:', {
          tableId,
          serialNo,
          availableFieldCount: availableFields.length,
          availableFieldNames: availableFields.map(field => field.name),
        });
        return [];
      }

      console.log('[bitableService] 流水号字段解析结果:', {
        tableId,
        serialNo,
        serialFieldId: serialField.id,
        serialFieldName: serialField.name,
        fieldCount: availableFields.length,
      });

      // 分页查询所有记录，筛选匹配流水号的
      const matchingRecords: RecordData[] = [];
      let pageToken: string | undefined;
      let scannedRecordCount = 0;
      let pageIndex = 0;
      const sampleSerialValues: Array<{ recordId: string; serialStr: string }> = [];

      do {
        const response = await table.getRecordsByPage({
          pageSize: 200,
          pageToken: pageToken ? Number(pageToken) : undefined,
          stringValue: true,
        });
        pageIndex += 1;

        for (const rec of response.records) {
          scannedRecordCount += 1;
          const serialVal = rec.fields[serialField.id];
          const serialStr = Array.isArray(serialVal)
            ? (serialVal as any[]).map(v => String(v ?? '')).join('\n')
            : String(serialVal ?? '');

          if (sampleSerialValues.length < 10) {
            sampleSerialValues.push({
              recordId: rec.recordId,
              serialStr: serialStr.trim(),
            });
          }

          // 精确匹配流水号
          if (serialStr.trim() === serialNo.trim()) {
            const fields: { fieldId: string; fieldName: string; value: string }[] = [];
            for (const fieldId of fieldIds) {
              const fieldMeta = availableFields.find(f => f.id === fieldId);
              const cellVal = rec.fields[fieldId];
              const cellStr = Array.isArray(cellVal)
                ? (cellVal as any[]).map(v => String(v ?? '')).join('\n')
                : String(cellVal ?? '');
              fields.push({
                fieldId,
                fieldName: fieldMeta?.name || '',
                value: cellStr,
              });
            }
            matchingRecords.push({ recordId: rec.recordId, fields });
          }
        }

        console.log('[bitableService] 分页扫描进度:', {
          tableId,
          serialNo,
          pageIndex,
          pageSize: response.records.length,
          scannedRecordCount,
          matchedCount: matchingRecords.length,
          hasMore: response.hasMore,
          nextPageToken: response.pageToken,
        });

        pageToken = response.hasMore ? (response.pageToken as string | undefined) : undefined;
      } while (pageToken);

      console.log('[bitableService] getRecordsBySerialNo 完成:', {
        tableId,
        serialNo,
        scannedRecordCount,
        matchedCount: matchingRecords.length,
        sampleSerialValues,
      });

      return matchingRecords;
    } catch (error) {
      console.error('[bitableService] 按流水号查询记录失败:', error);
      return [];
    }
  }

  /**
   * 【核心】聚合多行记录为一个订单对象
   */
  aggregateOrder(records: RecordData[]): AggregatedOrder {
    if (records.length === 0) {
      return {
        serialNo: '',
        header: { serialNo: '', poNumber: '', billTo: '', shipTo: '' },
        items: [],
        subtotal: '',
        shippingCost: '',
        total: '',
        sourceRecordIds: [],
      };
    }

    const conflicts: FieldConflict[] = [];
    const header: OrderHeader = { serialNo: '', poNumber: '', billTo: '', shipTo: '' };
    const items: OrderItem[] = [];
    const headerFields: Record<string, string[]> = {};

    for (const record of records) {
      const item: OrderItem = { product: '', qty: '', unitPrice: '', amount: '', description: '' };

      for (const field of record.fields) {
        const value = field.value.trim();

        if (this.isItemField(field.fieldName)) {
          const fieldName = field.fieldName.toLowerCase().replace(/\s+/g, '');
          if (fieldName === 'products') item.product = value;
          else if (fieldName === 'qty') item.qty = value;
          else if (fieldName === 'unitprice') item.unitPrice = value;
          else if (fieldName === 'amount') item.amount = value;
          else if (fieldName.includes('description') || fieldName.includes('颜色')) item.description = value;
        } else {
          if (!headerFields[field.fieldName]) {
            headerFields[field.fieldName] = [];
          }
          if (value) {
            headerFields[field.fieldName].push(value);
          }
        }
      }

      if (item.product || item.amount) {
        items.push(item);
      }
    }

    for (const [fieldName, values] of Object.entries(headerFields)) {
      const uniqueValues = [...new Set(values)];
      if (uniqueValues.length === 1) {
        this.setHeaderField(header, fieldName, uniqueValues[0]);
      } else if (uniqueValues.length > 1) {
        conflicts.push({
          fieldName,
          values: uniqueValues,
          usedValue: uniqueValues[0],
          otherValues: uniqueValues.slice(1),
        });
        this.setHeaderField(header, fieldName, uniqueValues[0]);
      }
    }

    let subtotal = 0;
    for (const item of items) {
      subtotal += parseFloat(item.amount) || 0;
    }

    let shippingCost = '';
    let total = '';
    for (const record of records) {
      for (const field of record.fields) {
        const fn = field.fieldName.toLowerCase().replace(/\s+/g, '');
        if (fn === 'subtotal' && field.value) subtotal = parseFloat(field.value) || subtotal;
        if (fn === 'shippingcost' || fn === 'shipping') shippingCost = field.value;
        if (fn === 'total' && field.value) total = field.value;
      }
    }

    // 优先使用表格中的 total 字段，否则计算 subtotal + shippingCost
    let finalTotal = total;
    if (!finalTotal) {
      const shippingNum = parseFloat(shippingCost) || 0;
      finalTotal = (subtotal + shippingNum).toFixed(2);
    }

    return {
      serialNo: header.serialNo,
      header,
      items,
      subtotal: subtotal.toFixed(2),
      shippingCost,
      total: finalTotal,
      sourceRecordIds: records.map(r => r.recordId),
      conflicts: conflicts.length > 0 ? conflicts : undefined,
    };
  }

  /**
   * 判断字段是否为商品级字段
   */
  private isItemField(fieldName: string): boolean {
    const normalized = fieldName.toLowerCase().replace(/\s+/g, '');
    return ITEM_FIELDS.some(f => f.toLowerCase().replace(/\s+/g, '') === normalized);
  }

  /**
   * 设置订单头字段
   */
  private setHeaderField(header: OrderHeader, fieldName: string, value: string): void {
    const normalized = fieldName.toLowerCase().replace(/\s+/g, '');
    if (matchesSerialFieldName(fieldName)) {
      header.serialNo = value;
    } else if (normalized === 'ponumber' || normalized === 'po') {
      header.poNumber = value;
    } else if (normalized === 'billto') {
      header.billTo = value;
    } else if (normalized === 'shipto') {
      header.shipTo = value;
    } else {
      header[fieldName] = value;
    }
  }

  /**
   * 获取字段在所有记录中的值
   */
  async getAllFieldValues(tableId: string, fieldId: string): Promise<string[]> {
    try {
      const table = await bitable.base.getTableById(tableId);
      const values: string[] = [];
      let pageToken: string | undefined;
      let pageIndex = 0;
      let scannedRecordCount = 0;

      do {
        const response = await table.getRecordsByPage({
          pageSize: 200,
          pageToken: pageToken ? Number(pageToken) : undefined,
          stringValue: true,
        });
        pageIndex += 1;

        for (const rec of response.records) {
          scannedRecordCount += 1;
          const cellVal = rec.fields[fieldId];
          const cellStr = Array.isArray(cellVal)
            ? (cellVal as any[]).map(v => String(v ?? '')).join('')
            : String(cellVal ?? '');
          if (cellStr.trim()) {
            values.push(cellStr.trim());
          }
        }

        console.log('[bitableService] getAllFieldValues 分页扫描:', {
          tableId,
          fieldId,
          pageIndex,
          pageSize: response.records.length,
          scannedRecordCount,
          collectedValueCount: values.length,
          hasMore: response.hasMore,
          nextPageToken: response.pageToken,
        });

        pageToken = response.hasMore ? (response.pageToken as string | undefined) : undefined;
      } while (pageToken);

      console.log('[bitableService] getAllFieldValues 完成:', {
        tableId,
        fieldId,
        scannedRecordCount,
        collectedValueCount: values.length,
        sampleValues: values.slice(0, 20),
      });

      return values;
    } catch (error) {
      console.error('[bitableService] 获取字段所有值失败:', error);
      return [];
    }
  }

  /**
   * 设置单元格值
   */
  async setCellValue(tableId: string, fieldId: string, recordId: string, value: string | number | boolean | null): Promise<void> {
    try {
      const table = await bitable.base.getTableById(tableId);
      console.log('[bitableService] setCellValue 入参:', { tableId, fieldId, recordId, value });

      const success = await table.setCellValue(fieldId, recordId, value as any);
      console.log('[bitableService] setCellValue 返回:', { fieldId, recordId, success });

      const verifiedValue = await table.getCellString(fieldId, recordId);
      console.log('[bitableService] setCellValue 读后校验:', { fieldId, recordId, verifiedValue });

      if (success === false) {
        throw new Error(`setCellValue 返回 false: fieldId=${fieldId}, recordId=${recordId}`);
      }
    } catch (error) {
      console.error('[bitableService] 设置单元格值失败:', error);
      throw error;
    }
  }

}

export const bitableService = new BitableService();
