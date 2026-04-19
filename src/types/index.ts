// 字段类型枚举（与飞书FieldType对应）
export enum FieldType {
  Text = 1,
  Number = 2,
  SingleSelect = 3,
  MultiSelect = 4,
  DateTime = 5,
  Checkbox = 7,
  User = 11,
  Phone = 13,
  Url = 15,
  Attachment = 17,
  SingleLink = 18,
  Lookup = 19,
  Formula = 20,
  DuplexLink = 21,
  Location = 22,
  GroupChat = 23,
  CreatedTime = 1001,
  ModifiedTime = 1002,
  CreatedUser = 1003,
  ModifiedUser = 1004,
  AutoNumber = 1005,
}

// 字段元数据
export interface FieldMeta {
  id: string;
  name: string;
  type: FieldType;
  selected: boolean;
}

// 字段值
export interface FieldValue {
  fieldId: string;
  fieldName: string;
  value: string;
}

// 记录数据（单条）
export interface RecordData {
  recordId: string;
  fields: FieldValue[];
}

// ============ 新增：聚合订单模型 ============

// 订单头信息（订单级字段）
export interface OrderHeader {
  serialNo: string;       // 流水号
  poNumber: string;       // PO号
  billTo: string;         // 账单地址
  shipTo: string;         // 收货地址
  // 其他订单级字段动态存储
  [key: string]: string;
}

// 订单明细行（商品级字段）
export interface OrderItem {
  product: string;        // 商品名
  description?: string;   // 描述（颜色/印刷等）
  qty: string;            // 数量
  unitPrice: string;      // 单价
  amount: string;         // 金额
}

// 聚合订单
export interface AggregatedOrder {
  serialNo: string;            // 流水号（聚合键）
  header: OrderHeader;         // 订单头信息
  items: OrderItem[];          // 商品明细列表
  subtotal: string;            // 小计
  shippingCost: string;        // 运费
  total: string;               // 总计
  // 原始记录ID列表（用于追踪数据来源）
  sourceRecordIds: string[];
  // 字段冲突信息
  conflicts?: FieldConflict[];
}

// 字段冲突信息
export interface FieldConflict {
  fieldName: string;
  values: string[];      // 冲突的值列表
  usedValue: string;     // 实际使用的值
  otherValues: string[]; // 被忽略的值
}

// 商品级字段名列表（用于聚合时判断哪些字段属于明细行）

// ============ 以下保持原有类型 ============

// 模板字段配置
export interface TemplateFieldConfig {
  required: string[];
  optional?: string[];
  editable?: string[];
  fixed?: Record<string, string>;
  // 金额相关字段（只读）
  amountFields?: string[];
  // 订单级字段（用于区分商品级）
  orderFields?: string[];
  // 商品级字段
  itemFields?: string[];
}

// PDF模板接口
export interface IPDFTemplate {
  id: string;
  name: string;
  description: string;
  fields?: TemplateFieldConfig;
  generate(data: AggregatedOrder, editedValues?: Record<string, string>): string;
}

// 飞书选中信息
export interface Selection {
  tableId: string;
  viewId: string;
  recordId?: string;
}

export interface InvoiceTableContext {
  tableId: string;
  tableName: string;
  fields: FieldMeta[];
  serialField: FieldMeta;
  piNumberField?: FieldMeta;
  piDateField?: FieldMeta;
  source: 'target-name';
}
