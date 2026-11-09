console.log("Bobbinly loaded");

function extractMessages() {
  const messages = document.querySelectorAll("div.adn");
  const results = [];

  messages.forEach((msg) => {
    const senderEl = msg.querySelector("span.gD");
    const dateEl = msg.querySelector("span.g3");
    const bodyEl = msg.querySelector("div.a3s");

    results.push({
      sender: senderEl ? senderEl.getAttribute("name") : "(unknown)",
      email: senderEl ? senderEl.getAttribute("email") : "",
      date: dateEl ? dateEl.getAttribute("title") : "",
      body: bodyEl ? cleanBody(bodyEl) : "(empty)"
    });
  });

  return results;
}

// One function that does the whole job, used by both the popup and Alt + B
async function getThreadText() {
  await expandAll();
  const subjectEl = document.querySelector("h2.hP");
  if (!subjectEl) return null; // no thread open
  return buildPlainText(subjectEl.innerText, extractMessages());
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
  copy.querySelectorAll(".gmail_quote, blockquote").forEach((q) => q.remove());
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
    text += m.body + "\n\n";
  });

  return text.trim();
}