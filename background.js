"use strict";

const menuId = "good-pass-fill";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: menuId,
    title: "Good Pass",
    contexts: ["editable"],
    documentUrlPatterns: ["http://*/*", "https://*/*"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === menuId) {
    openFillPopup(info, tab).catch((error) => console.error(error));
  }
});

async function openFillPopup(info, tab) {
  const params = new URLSearchParams({ fill: "" });

  try {
    const origin = new URL(info.pageUrl).origin;
    const requestId = crypto.randomUUID();
    const [{ documentId, result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id, frameIds: [info.frameId ?? 0] },
      func: captureInput,
      args: [requestId, info.frameUrl ?? info.pageUrl],
      injectImmediately: true
    });

    if (result && documentId) {
      params.set("fill", requestId);
      params.set("tab", tab.id);
      params.set("document", documentId);
      params.set("origin", origin);
    }
  } catch {
    // Restricted pages and frames may reject script injection.
  }

  await chrome.windows.create({
    type: "popup",
    url: chrome.runtime.getURL(`popup.html#${params}`),
    width: 400,
    height: 560
  });
}

function captureInput(requestId, frameUrl) {
  const isEditable = (input) => input instanceof HTMLInputElement &&
    ["password", "text"].includes(input.type) &&
    !input.readOnly && !input.matches(":disabled");

  let input = document.activeElement;
  while (input?.shadowRoot?.activeElement) input = input.shadowRoot.activeElement;
  if (location.href !== frameUrl || !isEditable(input)) return false;

  const target = new WeakRef(input);
  globalThis.goodPassFill = (id, password) => {
    if (id !== requestId) return false;
    delete globalThis.goodPassFill;

    const input = target.deref();
    if (location.href !== frameUrl || !input?.isConnected || !isEditable(input)) {
      return false;
    }

    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, password);
    input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return input.value === password;
  };
  return true;
}
