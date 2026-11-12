# Bobbinly

**Wind up the whole thread.**

Bobbinly is a Chrome extension that copies a whole Gmail or Outlook thread in one click, cleaned up and ready to paste into any AI assistant. It can also wrap the thread in a ready-made AI prompt with your idea for the reply, who you're writing to, the tone, and the length.

Everything runs on your computer. Bobbinly has no servers, no accounts, and no analytics.

[![Watch the Bobbinly demo](https://img.youtube.com/vi/ALwjIeMbY0c/maxresdefault.jpg)](https://www.youtube.com/watch?v=ALwjIeMbY0c)

> Chrome Web Store: [Bobbinly Extension](https://chromewebstore.google.com/detail/clnjipflponbmidnhmfhojodbjjckffn?utm_source=item-share-cb)
> Website and privacy policy: [dochiphi.github.io/bobbinly-site](https://dochiphi.github.io/bobbinly-site/)

---

## The problem

Using AI to reply to a long email thread means copying the whole conversation first. In Gmail and Outlook that's painful: older messages are collapsed, every reply repeats the ones before it, and signatures, buttons, and quoted text get in the way.

## What Bobbinly does

1. Open an email thread in Gmail or Outlook on the web
2. Click the Bobbinly icon
3. Choose **Plain thread** or **AI prompt**, then click **Copy thread**
4. Paste into your AI assistant

### Features

- **One-click extraction:** expands collapsed and hidden messages, then copies every message with sender, date, and text, oldest to newest
- **Repeated quotes removed:** quoted copies of earlier messages become short labels like `[repeats messages #1, #3]`
- **Forwards kept:** forwarded emails stay in, since they're new content
- **Attachments listed:** file names appear as `[Attachments: report.pdf]`, images as `[Image]`
- **AI prompt mode:** wraps the thread in a structured prompt with your idea, recipient, tone, and length
- **Follow-up detection:** if the last message is yours, the prompt asks for a follow-up instead of a reply
- **Your Spool:** save your name, a line about yourself, and how you write, so every prompt sounds like you
- **Floating glass panel:** a draggable, Apple-style frosted panel that sits on top of your inbox

---

## A note on using AI

Your own reply matters the most. Bobbinly helps you give an AI the full context, but the AI is only an assistant. It can misread a thread, get facts or dates wrong, or sound unlike you.

- **Read every draft before you send it.** You're the one sending it, not the AI.
- **Check the details:** names, dates, numbers, and anything you're agreeing to.
- **Make it yours.** Edit the draft until it says what you actually mean, in your own voice.
- **Think before pasting sensitive emails.** Once you paste a thread into an AI tool, it's handled under that tool's privacy policy, not Bobbinly's.

Use AI to get started faster, not to stop thinking.

---

## How it works

**Extraction.** A content script reads the email page directly, with a separate reader for each site:

- **Gmail:** clicks open collapsed messages one at a time (so it never closes one it already opened), then reads each message's sender, date, body, and attachments.
- **Outlook:** uses Outlook's built-in, language-independent IDs (`_FROM`, `_DATETIME`, `UniqueMessageBody`). Collapsed messages usually still contain the full text, so Bobbinly reads them without opening them.

**Repeat detection.** Email clients mark quoted text differently (Gmail, Outlook, Apple Mail, and helpdesk tools all differ), and quote headers like "On ... wrote:" change with the user's language. Instead of matching those formats, Bobbinly compares lines against earlier messages in the thread:

- Lines that exactly match an earlier message are replaced with a `[repeats message #N]` label
- Lines that don't match are always kept, so inline replies and forwards survive
- A block only counts as a repeat if it has 2+ matching lines or one long line, so short replies like "Thanks!" are never removed by mistake

This works in any language and with any email client.

**Isolated UI.** The panel lives in a **Shadow DOM**, so the email site's styles can't change it and its styles can't break the site. Dragging listens in the capture phase, because Gmail and Outlook stop many mouse events before they reach the page.

**Built to survive site updates.** Each site's selectors are kept in one list (`GMAIL` and `OUTLOOK`) at the top of the code, and a self-check warns when Gmail's stop matching. When a site changes its page, the fix is one line.

---

## Privacy

- Bobbinly itself sends nothing; it all runs on your computer
- A thread is only read when you click **Copy thread**
- Your Spool is saved with Chrome's built-in storage (synced across your own devices if Chrome Sync is on)
- No servers, no analytics, no tracking, no data sold or shared

Full policy: [dochiphi.github.io/bobbinly-site](https://dochiphi.github.io/bobbinly-site/)

---

## Install from source

1. Download or clone this repository
2. Go to `chrome://extensions` and turn on **Developer mode**
3. Click **Load unpacked** and select the project folder
4. Open Gmail or Outlook on the web (refresh it if it was already open) and click the Bobbinly icon

## Project structure

```
bobbinly/
├── manifest.json     Extension settings (Manifest V3)
├── content.js        Extraction, cleanup, repeat detection, and the floating panel
├── background.js     Opens the panel when the toolbar icon is clicked
├── options.html/js   Your Spool settings page (Chrome's right-click > Options)
└── icons/            Extension icons
```

## Built with

JavaScript, Chrome Extensions (Manifest V3), Shadow DOM, CSS animations, Chrome Storage API

---

## Known limitations

- Works with Gmail and Outlook on the web only (not desktop or mobile email apps)
- Outlook doesn't show email addresses on the page, so Outlook output shows sender names only
- In Gmail, Bobbinly opens collapsed messages to read them, so unread messages in that thread are marked as read
- Follow-up detection may miss your messages if you send from an alias address (Gmail) or if your name isn't in the tab title (Outlook)
- Gmail and Outlook can change their pages at any time; selectors are kept in one place so fixes are quick

## Roadmap

- Remember the panel's position between sessions
- Smooth height animation when switching modes

---

Made by [Ethan Do](https://github.com/dochiphi).