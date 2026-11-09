const fields = ["name", "about", "style"];

// Load saved values when the page opens
chrome.storage.sync.get(fields, (data) => {
  fields.forEach((f) => {
    document.getElementById(f).value = data[f] || "";
  });
});

// Save when the button is clicked
document.getElementById("saveBtn").addEventListener("click", () => {
  const data = {};
  fields.forEach((f) => (data[f] = document.getElementById(f).value.trim()));
  chrome.storage.sync.set(data, () => {
    document.getElementById("status").innerText = "Saved to your Spool.";
  });
});