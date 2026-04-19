<template>
  <div class="data-preview">
    <div class="header">
      <span class="step">步骤3:</span>
      <span class="title">数据预览</span>
    </div>
    <div class="preview-content">
      <div v-if="!order" class="empty">
        加载中...
      </div>
      <div v-else>
        <!-- Invoice Number 显示（仅 Invoice 模板） -->
        <div v-if="selectedTemplate === 'invoice'" class="invoice-number-section">
          <div class="section-title">Invoice Number</div>
          <div class="preview-item">
            <span class="label">PI号:</span>
            <span class="value invoice-number">{{ invoiceNumber || '-' }}</span>
          </div>
        </div>

        <!-- 订单基本信息 -->
        <div class="order-info-section">
          <div class="section-title">订单信息（流水号: {{ order.serialNo }}）</div>
          <div class="preview-item">
            <span class="label">商品项数:</span>
            <span class="value">{{ order.items.length }} 项</span>
          </div>
        </div>

        <!-- 固定信息 -->
        <div v-if="fixedFields && Object.keys(fixedFields).length > 0" class="fixed-section">
          <div class="section-title">固定信息</div>
          <div
            v-for="(value, key) in fixedFields"
            :key="key"
            class="preview-item"
          >
            <span class="label">{{ getFieldLabel(key) }}:</span>
            <span class="value fixed">{{ value }}</span>
          </div>
        </div>

        <!-- 商品明细 -->
        <div v-if="order.items.length > 0" class="items-section">
          <div class="section-title">商品和服务</div>
          <div
            v-for="(item, idx) in order.items"
            :key="idx"
            class="item-row"
          >
            <div class="item-header">商品 {{ idx + 1 }}</div>
            <div class="item-details">
              <div class="preview-item">
                <span class="label">PRODUCTS:</span>
                <span class="value item-product">{{ item.product || '-' }}</span>
              </div>
              <div v-if="item.description" class="preview-item">
                <span class="label">Description:</span>
                <span class="value">{{ item.description }}</span>
              </div>
              <div class="preview-item">
                <span class="label">QTY:</span>
                <span class="value">{{ item.qty || '-' }}</span>
              </div>
              <div class="preview-item">
                <span class="label">UNIT PRICE:</span>
                <span class="value">{{ item.unitPrice || '-' }}</span>
              </div>
              <div class="preview-item">
                <span class="label">AMOUNT:</span>
                <span class="value amount">{{ item.amount || '-' }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 金额区域 -->
        <div class="amount-section">
          <div class="section-title">金额信息</div>
          <div class="preview-item">
            <span class="label">Subtotal:</span>
            <span class="value amount">{{ order.subtotal || '-' }}</span>
          </div>
          <div class="preview-item">
            <span class="label">Shipping Cost:</span>
            <span class="value amount">{{ order.shippingCost || '-' }}</span>
          </div>
          <div class="preview-item">
            <span class="label">Total:</span>
            <span class="value amount total">{{ order.total || '-' }}</span>
          </div>
        </div>

        <!-- 可编辑字段 -->
        <div v-if="editableFieldList.length > 0" class="editable-section">
          <div class="section-title">可编辑字段</div>
          <div
            v-for="field in editableFieldList"
            :key="field.key"
            class="preview-item"
          >
            <span class="label">{{ field.label }}:</span>
            <textarea
              v-if="field.key === 'billTo' || field.key === 'shipTo'"
              v-model="localEditedValues[field.key]"
              class="editable-textarea"
              rows="3"
              @input="emitUpdate"
            ></textarea>
            <input
              v-else
              v-model="localEditedValues[field.key]"
              class="editable-input"
              @input="emitUpdate"
            />
          </div>
        </div>

        <!-- 冲突警告 -->
        <div v-if="order.conflicts && order.conflicts.length > 0" class="conflict-section">
          <div class="section-title conflict">字段冲突警告</div>
          <div
            v-for="(conflict, idx) in order.conflicts"
            :key="idx"
            class="conflict-item"
          >
            <span class="conflict-field">{{ conflict.fieldName }}:</span>
            <span class="conflict-values">使用 "{{ conflict.usedValue }}"，忽略 {{ conflict.otherValues.join(', ') }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue';
import type { AggregatedOrder, FieldMeta } from '../types';
import { getTemplateById } from '../templates';

interface Props {
  order: AggregatedOrder | null;
  selectedFields: FieldMeta[];
  selectedTemplate: string;
  editedValues: Record<string, string>;
  invoiceNumber?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:editedValues', values: Record<string, string>): void;
}>();

const localEditedValues = ref<Record<string, string>>({});

const getFieldLabel = (key: string): string => {
  const labels: Record<string, string> = {
    companyName: '公司名称',
    companyAddress: '公司地址',
    invoiceNumber: 'Invoice Number',
  };
  return labels[key] || key;
};

const fixedFields = computed(() => {
  const template = getTemplateById(props.selectedTemplate);
  return template?.fields?.fixed;
});

const editableFieldList = computed(() => {
  const template = getTemplateById(props.selectedTemplate);
  const editableFieldNames = template?.fields?.editable || [];
  const result: { key: string; label: string }[] = [];

  for (const name of editableFieldNames) {
    const key = name.toLowerCase().replace(/\s+/g, '');
    if (key === 'billto') {
      result.push({ key: 'billTo', label: 'Bill to' });
    } else if (key === 'shipto') {
      result.push({ key: 'shipTo', label: 'Ship to' });
    } else if (key === 'ponumber') {
      result.push({ key: 'poNumber', label: 'PO number' });
    } else if (key === 'shippingmethod') {
      result.push({ key: 'shippingMethod', label: 'Shipping method' });
    } else {
      result.push({ key, label: name });
    }
  }

  return result;
});

const emitUpdate = () => {
  emit('update:editedValues', { ...localEditedValues.value });
};

watch(() => props.editedValues, (newValues) => {
  localEditedValues.value = { ...newValues };
}, { immediate: true, deep: true });

watch(() => props.order, (newOrder) => {
  if (newOrder) {
    // Initialize edited values from order header
    for (const [key, value] of Object.entries(newOrder.header)) {
      if (value) {
        localEditedValues.value[key] = value;
      }
    }
    // 确保关键字段有值
    if (newOrder.header['PO number'] !== undefined) {
      localEditedValues.value['poNumber'] = newOrder.header['PO number'];
    }
    if (newOrder.header['Shipping method'] !== undefined) {
      localEditedValues.value['shippingMethod'] = newOrder.header['Shipping method'];
    }
    if (newOrder.header['Firm'] !== undefined) {
      localEditedValues.value['firm'] = newOrder.header['Firm'];
    }
    emitUpdate();
  }
}, { immediate: true });

onMounted(() => {
  localEditedValues.value = { ...props.editedValues };
});
</script>

<style scoped>
.data-preview {
  margin-bottom: 16px;
}

.header {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.step {
  font-weight: bold;
  color: #3370ff;
  margin-right: 8px;
}

.title {
  font-weight: 500;
}

.preview-content {
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 12px;
  min-height: 100px;
  background-color: #fafafa;
}

.empty {
  color: #999999;
  text-align: center;
  padding: 20px;
}

.section-title {
  font-size: 12px;
  color: #3370ff;
  font-weight: 500;
  margin-bottom: 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid #e8e8e8;
}

.section-title.conflict {
  color: #ff6b00;
}

.fixed-section,
.amount-section,
.editable-section,
.order-info-section,
.invoice-number-section,
.items-section,
.conflict-section {
  margin-bottom: 12px;
}

.fixed-section:last-child,
.amount-section:last-child,
.editable-section:last-child,
.order-info-section:last-child,
.invoice-number-section:last-child,
.items-section:last-child,
.conflict-section:last-child {
  margin-bottom: 0;
}

.preview-item {
  display: flex;
  align-items: center;
  padding: 4px 0;
}

.label {
  font-weight: 500;
  color: #666666;
  min-width: 120px;
  flex-shrink: 0;
}

.value {
  color: #333333;
}

.value.fixed {
  color: #666666;
}

.value.amount {
  color: #3370ff;
  font-weight: bold;
}

.value.invoice-number {
  color: #ff6b00;
  font-weight: bold;
  font-size: 14px;
}

.invoice-number-section {
  margin-bottom: 12px;
  padding: 8px;
  background-color: #fff8f0;
  border-radius: 4px;
  border: 1px solid #ffd9b3;
}

.conflict-section {
  padding: 8px;
  background-color: #fff8f0;
  border-radius: 4px;
  border: 1px solid #ffd9b3;
}

.conflict-item {
  font-size: 12px;
  color: #666;
  padding: 2px 0;
}

.conflict-field {
  font-weight: 500;
  color: #ff6b00;
}

.conflict-values {
  color: #999;
}

.editable-input {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 13px;
  background: white;
}

.editable-input:focus {
  border-color: #3370ff;
  outline: none;
}

.editable-textarea {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 13px;
  background: white;
  resize: vertical;
  font-family: inherit;
}

.editable-textarea:focus {
  border-color: #3370ff;
  outline: none;
}

/* 商品明细样式 */
.items-section {
  background-color: #f5f7fa;
  border-radius: 4px;
  padding: 10px;
}

.item-row {
  background-color: #fff;
  border-radius: 4px;
  margin-bottom: 8px;
  border: 1px solid #e0e0e0;
}

.item-row:last-child {
  margin-bottom: 0;
}

.item-header {
  font-size: 12px;
  font-weight: bold;
  color: #3370ff;
  padding: 6px 10px;
  background-color: #f0f5ff;
  border-bottom: 1px solid #e0e0e0;
  border-radius: 4px 4px 0 0;
}

.item-details {
  padding: 8px 10px;
}

.item-product {
  white-space: pre-line;
  word-break: break-word;
}

.value.total {
  font-size: 14px;
}
</style>
