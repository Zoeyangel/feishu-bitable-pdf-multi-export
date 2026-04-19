# feishu-bitable-pdf-multi-export

一个用于飞书多维表格的 PDF 导出插件，支持将选中记录导出为 PDF 文件。

## 功能特性

- **字段选择**：自由选择需要导出的字段
- **多模板支持**：默认模板和 Invoice 发票模板
- **实时预览**：导出前预览 PDF 效果
- **Invoice 编号自动生成**：自动查找最大 AG-XXX 编号并 +1
- **数据回填**：导出后自动回填 PI号 到多维表格

## 在飞书多维表格中使用

访问地址：
```
https://zoeyangel.github.io/feishu-bitable-pdf-export/
```

在飞书多维表格中：
1. 选中一行记录
2. 点击右上角「Base Extensions」
3. 点击「+ Add Script」
4. 输入上面的地址
5. 确认即可使用

## 开发

### 安装依赖

```bash
npm install
```

### 本地开发

```bash
npm run dev
```

### 构建

```bash
npm run build
```

## 部署到 GitHub Pages

项目已配置 GitHub Actions 自动部署，推送代码后会自动构建并部署到 GitHub Pages。

访问地址：https://zoeyangel.github.io/feishu-bitable-pdf-export/

## 使用方法

1. 在多维表格中选中一行记录
2. 选择需要导出的字段
3. 选择模板（默认/Invoice）
4. 点击「预览PDF」或「下载PDF」

## Invoice 模板

Invoice 模板会自动：
- 查找表格中 PI号 字段的最大编号
- 生成下一个编号（AG-XXX 格式）
- 导出后回填 PI号 到当前记录

## 技术栈

- Vue 3 + TypeScript
- @lark-base-open/js-sdk（飞书多维表格 SDK）
- jsPDF + html2canvas（PDF 生成）

## 许可证

MIT