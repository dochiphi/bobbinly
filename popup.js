const status = document.getElementById("status");
const promptFields = document.getElementById("promptFields");

function getMode() {
  return document.querySelector('input[name="mode"]:checked').value;
}

// Show the prompt fields only in AI prompt mode
function updateFields() {
  promptFields.style.display = getMode() === "prompt" ? "block" : "none";
}
document.querySelectorAll('input[name="mode"]').forEach((r) => r.addEventListener("change", updateFields));
updateFields();

// Wrap the thread in the structured prompt
function buildPrompt(threadText, spool) {
  const idea = document.getElementById("idea").value.trim();
  const relationship = document.getElementById("relationship").value;
  const tone = document.getElementById("tone").value;
  const length = document.getElementById("length").value;

  const lines = [];

  // About me: only added if the Spool has something in it
  if (spool.name || spool.about) {
    lines.push("## About me");
    if (spool.name) lines.push("Name: " + spool.name);
    if (spool.about) lines.push(spool.about);
    lines.push("");
  }

  lines.push(
    "## Recipient",
    "My " + relationship.toLowerCase(),
    "",
    "## Email thread",
    threadText,
    "",
    "## Task",
    "Write my reply to the latest message in this thread.",
    "",
    "## My idea",
    idea || "(No specific idea. Suggest the best reply.)",
    "",
    "## Constraints",
    "Tone: " + tone,
    "Length: " + length
  );
  if (spool.style) lines.push("My writing style: " + spool.style);
  lines.push("Output: the reply body only, no subject line.");

  return lines.join("\n");
}

document.getElementById("copyBtn").addEventListener("click", async () => {
  status.innerText = "Working...";
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: "getThread" });
    if (!response || !response.text) {
      status.innerText = "Open an email thread first.";
      return;
    }
    const spool = await chrome.storage.sync.get(["name", "about", "style"]);
    const output = getMode() === "prompt" ? buildPrompt(response.text, spool) : response.text;
    await navigator.clipboard.writeText(output);
    status.innerText = getMode() === "prompt" ? "Prompt copied! Paste it into your AI." : "Thread copied! Paste it into your AI.";
  } catch (err) {
    status.innerText = "Open Gmail first (refresh it once if it's already open).";
  }
});

document.getElementById("spoolLink").addEventListener("click", () => chrome.runtime.openOptionsPage());