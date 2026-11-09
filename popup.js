const status = document.getElementById("status");

document.getElementById("copyBtn").addEventListener("click", async () => {
  status.innerText = "Working...";
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: "getThread" });
    if (!response || !response.text) {
      status.innerText = "Open an email thread first.";
      return;
    }
    await navigator.clipboard.writeText(response.text);
    status.innerText = "Copied! Paste it into your AI.";
  } catch (err) {
    status.innerText = "Open Gmail first (refresh it once if it's already open).";
  }
});