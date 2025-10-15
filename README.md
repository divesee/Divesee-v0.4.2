# Divesee 潜读 浏览器插件 v0.4.2

## 安装（开发者模式）
1. 打开 Chrome → `chrome://extensions`。
2. 右上角开启**开发者模式**。
3. 点击**加载已解压的扩展程序**，选择本文件夹。


## 使用
- 页面左下角默认出现圆形“D”按钮，点击展开控制台。
- 拖动按钮到任一角落后松开，会自动贴边；面板展开方向也会调整。
- 点击页面任意处或按 `Esc` 可自动收起面板。
- “无声阅读”关闭时，速度条可调但不滚动；开启后即刻生效。
- AI 模式首次刷新本页时调用 `apiEndpoint` 的 `/api/analyze`，结果缓存于会话存储。

## 目录结构
- `manifest.json`
- `service_worker.js`
- `content/deepread.content.js`
- `content/deepread.panel.js`
- `content/deepread.styles.css`
- `content/stopwords-zh.txt`
- `assets/icon-16.png` / `icon-48.png` / `icon-128.png`

—— Divesee Team Demo · v0.4.2