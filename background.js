// Clicking the Bobbinly icon tells the Gmail tab to open/close the panel
chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.tabs.sendMessage(tab.id, { action: "togglePanel" });
  } catch (err) {
    // Not a Gmail tab, or Gmail was opened before the extension reloaded
    console.log("Bobbinly: no Gmail page here");
  }
});

// The panel can't open the settings page itself, so it asks us
chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "openSpool") chrome.runtime.openOptionsPage();
});