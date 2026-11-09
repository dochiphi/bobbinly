console.log("Bobbinly loaded");

// All of Gmail's class names in one place.
// If Gmail changes one, fix it here and nowhere else.
const GMAIL = {
  subject: "h2.hP",                // thread subject
  message: "div.adn",              // one expanded message
  sender: "span.gD",               // sender name + email
  date: "span.g3",                 // date (full date in its title)
  body: "div.a3s",                 // message body
  attachment: "span.aV3",          // attachment file name
  olderCircle: "span.adx",         // "N older messages" circle
  collapsedRow: "div.kv div.iA"    // clickable part of a collapsed message
};

// Self-check: which essential GMAIL names find nothing?
function checkGmailNames() {
  const required = ["subject", "message", "sender", "date", "body"];
  const missing = required.filter((key) => !document.querySelector(GMAIL[key]));

  // All missing = no thread open (normal). Some missing = Gmail probably changed.
  if (missing.length > 0 && missing.length < required.length) {
    console.warn("Bobbinly: Gmail may have changed. Not found:", missing.join(", "));
    return missing;
  }
  return [];
}

function extractMessages() {
  const messages = document.querySelectorAll(GMAIL.message);
  const results = [];

  messages.forEach((msg) => {
    const senderEl = msg.querySelector(GMAIL.sender);
    const dateEl = msg.querySelector(GMAIL.date);
    const bodyEl = msg.querySelector(GMAIL.body);
    // File names from Gmail's attachment area (Set removes duplicates)
    const files = [...new Set([...msg.querySelectorAll(GMAIL.attachment)].map((s) => s.innerText.trim()))];

    results.push({
      sender: senderEl ? senderEl.getAttribute("name") : "(unknown)",
      email: senderEl ? senderEl.getAttribute("email") : "",
      date: dateEl ? dateEl.getAttribute("title") : "",
      body: bodyEl ? cleanBody(bodyEl) : "(empty)",
      attachments: files
    });
  });

  return results;
}

// One function that does the whole job, used by both the popup and Alt + B
// Your account email, read from the tab title ("... - you@gmail.com - Gmail")
function getMyEmail() {
  const found = document.title.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  return found ? found[0].toLowerCase() : null;
}

async function getThreadText() {
  await expandAll();
  const missing = checkGmailNames();
  const subjectEl = document.querySelector(GMAIL.subject);
  if (!subjectEl) return null; // no thread open

  const messages = removeRepeats(extractMessages());
  const me = getMyEmail();
  const last = messages[messages.length - 1];
  console.log("Bobbinly me:", me); // temporary check

  return {
    text: buildPlainText(subjectEl.innerText, messages),
    lastIsMine: !!(me && last && last.email.toLowerCase() === me),
    missing: missing
  };
}

// Listen for the popup asking for the thread
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "togglePanel") {
    togglePanel();
  }
    if (request.action === "getThread") {
    getThreadText().then((result) => sendResponse(result || {}));
    return true; // tells Chrome the answer will come later
  }
});

// Keep Alt + B as a shortcut
document.addEventListener("keydown", async (e) => {
  if (e.altKey && e.key.toLowerCase() === "b") {
    const result = await getThreadText();
    if (result) await navigator.clipboard.writeText(result.text);
  }
});

function realClick(el) {
  ["mousedown", "mouseup", "click"].forEach((type) => {
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
  });
}

async function expandAll() {
  for (let i = 0; i < 50; i++) {
    // Circle first, then collapsed rows (clicked on the inner part Gmail listens to)
    const next =
      document.querySelector(GMAIL.olderCircle) ||
      document.querySelector(GMAIL.collapsedRow);

    if (!next) {
      console.log("Bobbinly: all expanded after", i, "clicks");
      return true;
    }
    console.log("Bobbinly: clicking", next.className);
    realClick(next);
    await new Promise((r) => setTimeout(r, 300));
  }
  console.log("Bobbinly: gave up after 50 clicks");
  return false;
}

function cleanBody(bodyEl) {
  const copy = bodyEl.cloneNode(true); // work on a copy, never touch Gmail's page
  
  // Images: keep emoji, mark real images, drop invisible tracking pixels
  copy.querySelectorAll("img").forEach((img) => {
    const alt = img.getAttribute("alt") || "";
    if (alt && alt.length <= 8) img.replaceWith(alt);    // Gmail shows emoji as small images
    else if (img.width > 1) img.replaceWith("[Image]");
    else img.remove();                                   // 1-pixel tracking images
  });

  // Gmail's buttons (Download, Add to Drive...) are not part of the message
  copy.querySelectorAll('button, [role="button"], [role="tooltip"]').forEach((b) => b.remove());

  // Signatures Gmail marks as signatures (typed sign-offs are kept)
  copy.querySelectorAll(".gmail_signature").forEach((s) => s.remove());

  // The copy must be on the page (off-screen) for innerText to keep line breaks
  copy.style.cssText = "position:fixed; left:-9999px; top:0;";
  document.body.appendChild(copy);
  const text = copy.innerText.trim();
  copy.remove();
  return text;
}

function buildPlainText(subject, messages) {
  let text = "Subject: " + subject + "\n";
  text += "Email thread (oldest to newest)\n\n";

  messages.forEach((m, i) => {
    text += "[" + (i + 1) + "] From: " + m.sender + " <" + m.email + "> | Date: " + m.date + "\n";
    text += m.body + "\n";
    if (m.attachments.length) text += "[Attachments: " + m.attachments.join(", ") + "]\n";
    text += "\n";
  });

  return text.trim();
}

// Makes lines comparable: drops leading ">" quote marks, extra spaces, and capitals
function normalize(line) {
  return line.replace(/^[>\s]+/, "").replace(/\s+/g, " ").trim().toLowerCase();
}

function removeRepeats(messages) {
  const seen = new Map(); // line -> number of the message it first appeared in

  messages.forEach((m, i) => {
    const lines = m.body.split("\n");

    // For each line: which earlier message had it (or null)
    const match = lines.map((l) => {
      const n = normalize(l);
      return n && seen.has(n) ? seen.get(n) : null;
    });

    // Remember this message's lines for the messages after it
    lines.forEach((l) => {
      const n = normalize(l);
      if (n && !seen.has(n)) seen.set(n, i + 1);
    });

    const out = [];
    let j = 0;
    while (j < lines.length) {
      if (match[j] === null) { out.push(lines[j]); j++; continue; }

      // Collect a block of matching lines (blank lines don't break the block)
      let end = j, count = 0, longest = 0;
      while (end < lines.length && (match[end] !== null || normalize(lines[end]) === "")) {
        if (match[end] !== null) {
          count++;
          longest = Math.max(longest, normalize(lines[end]).length);
        }
        end++;
      }

      if (count >= 2 || longest >= 25) {
        // Real repeat: replace with labels
        let last = null;
        for (let k = j; k < end; k++) {
          if (match[k] !== null && match[k] !== last) {
            out.push("[repeats message #" + match[k] + "]");
            last = match[k];
          }
        }
      } else {
        // Too short to be sure: keep it
        for (let k = j; k < end; k++) out.push(lines[k]);
      }
      j = end;
    }

    m.body = tidyLabels(out).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  });

  return messages;
}

function tidyLabels(lines) {
  const isLabel = (l) => /^\[repeats message #\d+\]$/.test(l);
  const isAttribution = (l) => /<[^>\s]+@[^>\s]+>/.test(l) && l.length < 200;

  // Rule 1: drop "On ... <email> wrote:" lines that sit right before a label
  const kept = lines.filter((l, i) => {
    if (!isAttribution(l)) return true;
    const next = lines.slice(i + 1).find((x) => x.trim() !== "");
    return next !== undefined && !isLabel(next); // drop if a label follows, or nothing follows
  });

  // Rule 2: merge labels that follow each other (blank lines between them are skipped)
  const out = [];
  let group = null;
  kept.forEach((l) => {
    if (isLabel(l)) {
      const n = l.match(/\d+/)[0];
      if (!group) { group = []; out.push(group); }
      if (!group.includes(n)) group.push(n);
    } else if (l.trim() === "" && group) {
      // blank line inside a run of labels: skip it
    } else {
      group = null;
      out.push(l);
    }
  });

  return out.map((x) =>
    Array.isArray(x)
      ? (x.length === 1 ? "[repeats message #" + x[0] + "]" : "[repeats messages #" + x.join(", #") + "]")
      : x
  );
}

// ---------- Floating glass panel ----------
let panelHost = null;

function createPanel() {
  panelHost = document.createElement("div");
  document.body.appendChild(panelHost);

  // Shadow DOM: a sealed bubble. Gmail's styles can't get in, ours can't leak out.
  const shadow = panelHost.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; }

      /* The glass panel */
      .panel {
        position: fixed; top: 72px; right: 24px; z-index: 2147483647;
        width: 320px; padding: 16px;
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif;
        color: #1d1d1f;
        background: rgba(226, 226, 226, 0.66);
        backdrop-filter: blur(20px) saturate(180%);
        border: 0.5px solid rgba(216, 215, 215, 0.6);
        border-radius: 22px;
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
      }

      /* Header with title and close button */
      .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; cursor: grab; user-select: none; }
      .title { font-size: 17px; font-weight: 600; letter-spacing: -0.2px; }
      .close {
        all: unset; width: 24px; height: 24px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 13px; color: #6e6e73; background: rgba(0, 0, 0, 0.06);
        cursor: pointer; transition: background 0.15s, color 0.15s;
      }
      #closeBtn:hover { background: #ff5f57; color: #fff; }
      #spoolBtn:hover { background: #28c840; color: #fff; }
      /* Inner glass sections */
      .modes, .fields {
        background: rgba(255, 255, 255, 0.5);
        border: 0.5px solid rgba(207, 207, 207, 0.3);
        border-radius: 14px;
      }

      /* Segmented control */
      .modes { display: flex; padding: 3px; }
      .modes label {
        flex: 1; padding: 6px 0; text-align: center; border-radius: 11px;
        font-size: 13px; color: #6e6e73; cursor: pointer; transition: all 0.2s;
      }
      .modes input { display: none; }
      .modes label:has(input:checked) {
        background: #fff; color: #1d1d1f; font-weight: 500;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
      }

      /* Fields */
      .fields { margin-top: 12px; padding: 4px 12px 12px; }
      .fields label { display: block; margin-top: 10px; font-size: 12px; color: #6e6e73; }
      input, textarea, select {
        width: 100%; margin-top: 4px; padding: 8px 10px;
        font: inherit; font-size: 13px; color: #1d1d1f;
        background: rgba(255, 255, 255, 0.5);
        border: 0.5px solid rgba(0, 0, 0, 0.08); border-radius: 10px; outline: none;
      }
      textarea { height: 64px; resize: vertical; }
      textarea:focus, select:focus { border-color: #007aff; box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.2); }

      /* Main button */
      .copy {
        width: 100%; margin-top: 14px; padding: 11px; border: none; border-radius: 12px;
        background: #007aff; color: #fff; font: inherit; font-size: 15px; font-weight: 500;
        cursor: pointer; transition: transform 0.1s, background 0.2s;
      }
      .copy:hover { background: #0068d9; }
      .copy:active { transform: scale(0.98); }

      #status, #spoolStatus { margin-top: 8px; min-height: 16px; font-size: 12px; color: #6e6e73; text-align: center; }
      p { margin: 6px 0 0; text-align: center; }
      a { color: #007aff; text-decoration: none; font-size: 12px; }
      .actions { display: flex; gap: 6px; } 
    </style>

    <div class="panel">
      <div class="header">
        <span class="title" id="title">Bobbinly</span>
        <div class="actions">
          <button class="close" id="spoolBtn" title="Your Spool">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
          <button class="close" id="closeBtn">✕</button>
        </div>
      </div>

      <div id="mainView">

      <div class="modes">
        <label><input type="radio" name="mode" value="plain" checked> Plain thread</label>
        <label><input type="radio" name="mode" value="prompt"> AI prompt</label>
      </div>

      <div class="fields" id="promptFields">
        <label>My idea for the reply
          <textarea id="idea" placeholder="e.g. Say yes, but ask to move it to Friday"></textarea>
        </label>
        <label>Recipient is my
          <select id="relationship">
            <option>Boss / manager</option><option>Professor</option><option>Client</option>
            <option>Coworker</option><option>Friend</option><option>Other</option>
          </select>
        </label>
        <label>Tone
          <select id="tone">
            <option>Professional</option><option>Friendly</option><option>Firm</option><option>Apologetic</option>
          </select>
        </label>
        <label>Length
          <select id="length">
            <option>Short</option><option>Medium</option><option>Long</option>
          </select>
        </label>
      </div>

      <button class="copy" id="copyBtn">Copy thread</button>
      <div id="status"></div>
      <p><a href="#" id="spoolLink">Edit Your Spool</a></p>
      </div>

      <div id="spoolView" style="display:none">
        <div class="fields">
          <label>Your name
            <input id="spoolName" placeholder="e.g. Ethan">
          </label>
          <label>About you
            <textarea id="spoolAbout" placeholder="e.g. Aerospace engineering student at UC"></textarea>
          </label>
          <label>How you write
            <textarea id="spoolStyle" placeholder="e.g. Short and direct. Sign off with 'Best, Ethan'"></textarea>
          </label>
        </div>
        <button class="copy" id="saveSpoolBtn">Save</button>
        <div id="spoolStatus"></div>
        <p><a href="#" id="backLink">‹ Back</a></p>
      </div>
    </div>
  `;

  // Drag the panel by its header
  const panel = shadow.querySelector(".panel");
  const header = shadow.querySelector(".header");
  let drag = null;

  header.addEventListener("mousedown", (e) => {
    if (e.target.closest(".close")) return; // clicking ✕ shouldn't start a drag
    const r = panel.getBoundingClientRect();
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top }; // where you grabbed it
    e.preventDefault(); // stops text from being selected while dragging
  });

  window.addEventListener("mousemove", (e) => {
    if (!drag) return;
    // Keep the panel inside the window
    const x = Math.min(Math.max(0, e.clientX - drag.dx), window.innerWidth - panel.offsetWidth);
    const y = Math.min(Math.max(0, e.clientY - drag.dy), window.innerHeight - panel.offsetHeight);
    panel.style.left = x + "px";
    panel.style.top = y + "px";
    panel.style.right = "auto"; // stop sticking to the right edge
  }, true);

  window.addEventListener("mouseup", () => { drag = null; }, true);
  // Close button hides the panel
  shadow.getElementById("closeBtn").addEventListener("click", () => {
    panelHost.style.display = "none";
  });
    const $ = (id) => shadow.getElementById(id);
  const status = $("status");

  // Mode switch: show the fields only in AI prompt mode
  const getMode = () => shadow.querySelector('input[name="mode"]:checked').value;
  const updateFields = () => {
    $("promptFields").style.display = getMode() === "prompt" ? "block" : "none";
  };
  shadow.querySelectorAll('input[name="mode"]').forEach((r) => r.addEventListener("change", updateFields));
  updateFields();

  // Copy button
  $("copyBtn").addEventListener("click", async () => {
    status.innerText = "Working...";
    const result = await getThreadText();
    if (!result) {
      status.innerText = "Open an email thread first.";
      return;
    }

    let output = result.text;
    if (getMode() === "prompt") {
      const spool = await chrome.storage.sync.get(["name", "about", "style"]);
      output = buildPrompt(result.text, spool, result.lastIsMine, {
        idea: $("idea").value.trim(),
        relationship: $("relationship").value,
        tone: $("tone").value,
        length: $("length").value
      });
    }

    try {
      await navigator.clipboard.writeText(output);
      status.innerText = getMode() === "prompt" ? "Prompt copied! Paste it into your AI." : "Thread copied! Paste it into your AI.";
      if (result.missing.length) status.innerText += " Some parts may be missing: Gmail may have changed.";
    } catch (err) {
      status.innerText = "Couldn't copy. Click inside Gmail once and try again.";
    }
  });

  // "Edit Your Spool": ask background.js to open the settings page
  // Switch between the main view and Your Spool
  const showView = (name) => {
    $("mainView").style.display = name === "main" ? "block" : "none";
    $("spoolView").style.display = name === "spool" ? "block" : "none";
    $("title").innerText = name === "spool" ? "Your Spool" : "Bobbinly";
  };

  // Load saved values, then show the Spool view
  const openSpool = async () => {
    const data = await chrome.storage.sync.get(["name", "about", "style"]);
    $("spoolName").value = data.name || "";
    $("spoolAbout").value = data.about || "";
    $("spoolStyle").value = data.style || "";
    $("spoolStatus").innerText = "";
    showView("spool");
  };

  // ⚙ toggles between the two views
  $("spoolBtn").addEventListener("click", () => {
    $("spoolView").style.display === "block" ? showView("main") : openSpool();
  });
  $("spoolLink").addEventListener("click", (e) => { e.preventDefault(); openSpool(); });
  $("backLink").addEventListener("click", (e) => { e.preventDefault(); showView("main"); });

  // Save
  $("saveSpoolBtn").addEventListener("click", async () => {
    await chrome.storage.sync.set({
      name: $("spoolName").value.trim(),
      about: $("spoolAbout").value.trim(),
      style: $("spoolStyle").value.trim()
    });
    $("spoolStatus").innerText = "Saved to your Spool.";
  });
}

// Icon click: create the panel the first time, then show/hide it
function togglePanel() {
  if (!panelHost) { createPanel(); return; }
  panelHost.style.display = panelHost.style.display === "none" ? "block" : "none";
}

function buildPrompt(threadText, spool, lastIsMine, f) {
  const lines = [];

  if (spool.name || spool.about) {
    lines.push("## About me");
    if (spool.name) lines.push("Name: " + spool.name);
    if (spool.about) lines.push(spool.about);
    lines.push("");
  }

  lines.push(
    "## Recipient",
    "My " + f.relationship.toLowerCase(),
    "",
    "## Email thread",
    threadText,
    "",
    "## Task",
    lastIsMine
      ? "The latest message in this thread is mine and has no reply yet. Write a polite follow-up."
      : "Write my reply to the latest message in this thread.",
    "",
    "## My idea",
    f.idea || "(No specific idea. Suggest the best reply.)",
    "",
    "## Constraints",
    "Tone: " + f.tone,
    "Length: " + f.length
  );
  if (spool.style) lines.push("My writing style: " + spool.style);
  lines.push("Output: the reply body only, no subject line.");

  return lines.join("\n");
}