import type { IPDFTemplate, AggregatedOrder } from '../types';

export const DefaultTemplate: IPDFTemplate = {
  id: 'default',
  name: '默认',
  description: '基础记录模板，字段-值列表形式',
  fields: {
    required: [],
    optional: [],
  },

  generate(data: AggregatedOrder, editedValues?: Record<string, string>): string {
    // 订单头信息
    const headerRows = Object.entries(data.header)
      .filter(([, value]) => value)
      .map(([key, value]) => {
        const displayValue = editedValues?.[key] ?? value;
        void key;
        const label = key === 'serialNo' ? '流水号' :
                      key === 'poNumber' ? 'PO Number' :
                      key === 'billTo' ? 'Bill To' :
                      key === 'shipTo' ? 'Ship To' : key;
        return `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e0e0e0; font-weight: 500; color: #666; width: 30%;">${label}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e0e0e0; width: 70%; white-space: pre-line;">${displayValue || '-'}</td>
        </tr>
      `}).join('');

    // 商品明细表
    const itemRows = data.items.map((item, index) => `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e0e0e0; text-align: center;">${index + 1}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e0e0e0;">${item.product || '-'}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e0e0e0; text-align: center;">${item.qty || '-'}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e0e0e0; text-align: right;">${item.unitPrice || '-'}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e0e0e0; text-align: right; font-weight: bold;">${item.amount || '-'}</td>
        </tr>
    `).join('');

    return `
      <div style="font-family: Arial, 'Microsoft YaHei', 'PingFang SC', sans-serif; padding: 20px;">
        <h1 style="font-size: 24px; font-weight: bold; margin-bottom: 20px; color: #333;">订单详情</h1>

        <!-- 订单头信息 -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tbody>
            ${headerRows}
          </tbody>
        </table>

        <!-- 商品明细 -->
        <h2 style="font-size: 16px; font-weight: bold; margin: 20px 0 10px; color: #333;">商品明细</h2>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #e0e0e0;">
          <thead>
            <tr style="background-color: #f5f5f5;">
              <th style="padding: 10px 12px; border-bottom: 2px solid #ddd; text-align: center; width: 40px;">#</th>
              <th style="padding: 10px 12px; border-bottom: 2px solid #ddd; text-align: left;">PRODUCTS</th>
              <th style="padding: 10px 12px; border-bottom: 2px solid #ddd; text-align: center; width: 60px;">QTY</th>
              <th style="padding: 10px 12px; border-bottom: 2px solid #ddd; text-align: right; width: 80px;">UNIT PRICE</th>
              <th style="padding: 10px 12px; border-bottom: 2px solid #ddd; text-align: right; width: 80px;">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
          </tbody>
        </table>

        <!-- 金额汇总 -->
        <div style="margin-top: 20px; text-align: right;">
          <table style="margin-left: auto;">
            <tr>
              <td style="padding: 6px 20px 6px 0; color: #555;">Subtotal:</td>
              <td style="padding: 6px 0; font-weight: bold; width: 80px; text-align: right;">${data.subtotal || '-'}</td>
            </tr>
            ${data.shippingCost ? `<tr>
              <td style="padding: 6px 20px 6px 0; color: #555;">Shipping:</td>
              <td style="padding: 6px 0; font-weight: bold; text-align: right;">${data.shippingCost}</td>
            </tr>` : ''}
            <tr style="font-weight: bold; font-size: 12pt;">
              <td style="padding: 10px 20px 10px 0; color: #000; border-top: 2px solid #000;">Total:</td>
              <td style="padding: 10px 0; text-align: right; border-top: 2px solid #000;">${data.total || '-'}</td>
            </tr>
          </table>
        </div>

        ${data.conflicts && data.conflicts.length > 0 ? `
        <!-- 冲突警告 -->
        <div style="margin-top: 20px; padding: 10px; background-color: #fff8f0; border: 1px solid #ffd9b3; border-radius: 4px;">
          <div style="font-size: 10pt; font-weight: bold; color: #ff6b00; margin-bottom: 8px;">字段冲突警告</div>
          ${data.conflicts.map(c => `<div style="font-size: 9pt; color: #666;">${c.fieldName}: 使用 "${c.usedValue}"，忽略 ${c.otherValues.join(', ')}</div>`).join('')}
        </div>
        ` : ''}
      </div>
    `;
  },
};
