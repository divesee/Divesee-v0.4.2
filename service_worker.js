chrome.runtime.onInstalled.addListener(async () => {
  const DEFAULT_SETTINGS = {
    enabledByDefault: false,
    // 模式：normal / ai （互斥，面板会切换 CURRENT_ON）
    mode: "normal",
    aiEnabled: false,
    immersiveTheme: "normal", // normal | dark
    aiHighlightMain: true,
    aiMarkParagraphTopics: true,
    aiHighlightKeywords: true,
    fontSizeStep: 0,        // 0~8 px
    lineHeight: 1.8,        // 1.2~2.4
    twoColumn: false,
    focusMode: false,
    silentMode: false,
    wpm: 0,
    apiEndpoint: "https://api.divesee.com:9443",
    overlayEnabled: true,   // 悬浮面板开关
    aboutVer: "v0.3"
  };
  const { settings } = await chrome.storage.sync.get("settings");
  if (!settings) await chrome.storage.sync.set({ settings: DEFAULT_SETTINGS });
});
