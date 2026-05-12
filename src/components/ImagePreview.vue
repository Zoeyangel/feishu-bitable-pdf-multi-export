<template>
  <Teleport to="body">
    <div v-if="visible" class="image-preview-overlay" @click="onClose">
      <div class="image-preview-container" @click.stop>
        <div class="image-preview-header">
          <span class="preview-title">PDF 预览</span>
          <button class="btn-close" @click="onClose">✕</button>
        </div>
        <div class="image-preview-body">
          <div v-if="loading" class="preview-loading">
            <div class="loading-spinner"></div>
            <p>正在生成预览...</p>
          </div>
          <div v-else-if="error" class="preview-error">
            <p>{{ error }}</p>
            <button class="btn-retry" @click="onRetry">重试</button>
          </div>
          <div v-else class="preview-image-wrapper" @click="openInNewTab">
            <img
              :src="imageUrl"
              alt="PDF Preview"
              class="preview-image"
              @load="onImageLoad"
              @error="onImageError"
            />
            <div class="image-overlay">
              <span class="open-hint">👆 点击查看大图</span>
            </div>
          </div>
        </div>
        <div class="image-preview-footer">
          <p class="preview-hint">
            <span class="hint-icon">ℹ️</span>
            此为图片预览，如需下载请使用"下载PDF"按钮
          </p>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

interface Props {
  visible: boolean;
  imageUrl: string;
  loading: boolean;
  error: string | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'retry'): void;
}>();

const imageLoaded = ref(false);

const onClose = () => {
  emit('close');
};

const onRetry = () => {
  imageLoaded.value = false;
  emit('retry');
};

const onImageLoad = () => {
  imageLoaded.value = true;
};

const onImageError = () => {
  imageLoaded.value = false;
};

// 在新标签页打开图片
const openInNewTab = () => {
  if (!props.imageUrl) return;

  // 创建一个完整的 HTML 页面来显示图片
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PDF 预览 - 大图</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      background: #e8e8e8;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .header {
      width: 100%;
      max-width: 800px;
      margin-bottom: 12px;
    }
    .header h1 {
      font-size: 16px;
      color: #333;
      margin-bottom: 4px;
    }
    .header p {
      font-size: 12px;
      color: #666;
    }
    .image-container {
      background: white;
      padding: 0;
      border-radius: 4px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      max-width: 100%;
      /* A4 比例: 210mm x 297mm, 约 1:1.414 */
      max-width: min(800px, 95vw);
    }
    img {
      width: 100%;
      height: auto;
      display: block;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>PDF 预览 - 大图</h1>
    <p>如需下载 PDF 文件，请返回原页面点击"下载PDF"按钮</p>
  </div>
  <div class="image-container">
    <img src="${props.imageUrl}" alt="PDF Preview">
  </div>
</body>
</html>
  `;

  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const newWindow = window.open(url, '_blank');
  if (newWindow) {
    newWindow.focus();
  }
};

// 当 visible 变为 true 时重置状态
watch(() => props.visible, (newVal) => {
  if (newVal) {
    imageLoaded.value = false;
  }
});

// ESC 键关闭
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.visible) {
    onClose();
  }
};

// 监听键盘事件
watch(() => props.visible, (newVal) => {
  if (newVal) {
    document.addEventListener('keydown', handleKeydown);
  } else {
    document.removeEventListener('keydown', handleKeydown);
  }
});
</script>

<style scoped>
.image-preview-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.image-preview-container {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.image-preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e0e0e0;
  background: #fafafa;
}

.preview-title {
  font-size: 16px;
  font-weight: 600;
  color: #333333;
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
  transition: all 0.2s;
}

.btn-close:hover {
  background: #f0f0f0;
  color: #333333;
}

.image-preview-body {
  flex: 1;
  overflow: auto;
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 300px;
  min-height: 200px;
}

.preview-image-wrapper {
  max-width: 100%;
  max-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  cursor: pointer;
}

.preview-image-wrapper:hover .image-overlay {
  opacity: 1;
}

.preview-image-wrapper:hover .preview-image {
  opacity: 0.9;
}

.preview-image {
  max-width: 100%;
  max-height: 70vh;
  width: auto;
  height: auto;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  user-select: none;
  -webkit-user-drag: none;
  transition: opacity 0.2s;
}

.image-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
  opacity: 0;
  transition: opacity 0.2s;
  border-radius: 4px;
}

.open-hint {
  background: rgba(255, 255, 255, 0.95);
  padding: 10px 20px;
  border-radius: 20px;
  font-size: 14px;
  color: #333333;
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.preview-loading {
  text-align: center;
  padding: 40px;
  color: #666666;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e0e0e0;
  border-top-color: #3370ff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.preview-error {
  text-align: center;
  padding: 40px;
  color: #f56c6c;
}

.btn-retry {
  margin-top: 16px;
  padding: 8px 20px;
  background: #3370ff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-retry:hover {
  background: #2860e1;
}

.image-preview-footer {
  padding: 10px 16px;
  border-top: 1px solid #e0e0e0;
  background: #fafafa;
}

.preview-hint {
  margin: 0;
  font-size: 12px;
  color: #999999;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.hint-icon {
  font-size: 14px;
}
</style>
