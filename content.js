console.log("Bobbinly loaded");

function extractMessages() {
  const messages = document.querySelectorAll("div.adn");
  const results = [];

  messages.forEach((msg) => {
    const senderEl = msg.querySelector("span.gD");
    const dateEl = msg.querySelector("span.g3");
    const bodyEl = msg.querySelector("div.a3s");
    // File names from Gmail's attachment area (Set removes duplicates)
    const files = [...new Set([...msg.querySelectorAll("span.aV3")].map((s) => s.innerText.trim()))];

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
async function getThreadText() {
  await expandAll();
  const subjectEl = document.querySelector("h2.hP");
  if (!subjectEl) return null; // no thread open
  return buildPlainText(subjectEl.innerText, removeRepeats(extractMessages()));
}

// Listen for the popup asking for the thread
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getThread") {
    getThreadText().then((text) => sendResponse({ text: text }));
    return true; // tells Chrome the answer will come later
  }
});

// Keep Alt + B as a shortcut
document.addEventListener("keydown", async (e) => {
  if (e.altKey && e.key.toLowerCase() === "b") {
    const text = await getThreadText();
    if (text) await navigator.clipboard.writeText(text);
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
      document.querySelector("span.adx") ||
      document.querySelector("div.kv div.iA");

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
    return !(next && isLabel(next));
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