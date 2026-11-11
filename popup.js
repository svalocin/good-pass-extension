"use strict";

const message = (key) => chrome.i18n.getMessage(key);
document.documentElement.lang = message("locale_tag");

for (const element of document.querySelectorAll("[data-message]")) {
  element.textContent = message(element.dataset.message);
}
for (const element of document.querySelectorAll("[data-placeholder]")) {
  element.placeholder = message(element.dataset.placeholder);
}

const form = document.getElementById("password-form");
const configuration = document.getElementById("configuration");
const master = document.getElementById("master");
const site = document.getElementById("site");
const toggleMaster = document.getElementById("toggle-master");
const prefix = document.getElementById("prefix");
const suffix = document.getElementById("suffix");
const mode = document.getElementById("mode");
const generate = document.getElementById("generate");
const statusMessage = document.getElementById("status");
const resultCard = document.getElementById("result-card");
const resultValue = document.getElementById("result-value");
const fillRequest = new URLSearchParams(location.hash.slice(1));
const fillMode = fillRequest.has("fill");
let submitting = false;
let statusTimeout;

function showResult(password) {
  resultCard.classList.add("has-result");
  resultValue.classList.remove("is-placeholder");
  resultValue.textContent = password;
}

function setStatus(key, state, persistent = false) {
  clearTimeout(statusTimeout);
  statusMessage.textContent = message(key);
  statusMessage.dataset.state = state;
  if (!persistent) {
    statusTimeout = setTimeout(() => {
      statusMessage.textContent = "";
      delete statusMessage.dataset.state;
    }, 3000);
  }
}

function getSiteIdentifier(url) {
  if (!url) return "";

  const { protocol, hostname } = new URL(url);
  if (protocol !== "http:" && protocol !== "https:") return "";

  const parsed = tldts.parse(hostname, { allowPrivateDomains: true });
  return (
    ((parsed.isIcann || parsed.isPrivate) && parsed.domainWithoutSuffix) ||
    hostname.replace(/\.$/, "")
  );
}

function sanitize(value) {
  return value.replace(/\s/g, "").toUpperCase();
}

function generatePassword(
  masterPassword,
  siteIdentifier,
  prefixValue,
  suffixValue,
  passwordMode,
) {
  // Preserve the website's legacy algorithm so existing passwords still match.
  const core = md5("GP" + sanitize(masterPassword) + sanitize(siteIdentifier))
    .slice(0, 8)
    .toUpperCase();
  const start = sanitize(prefixValue).toLowerCase();
  const end = sanitize(suffixValue).toLowerCase();

  switch (passwordMode) {
    case "numbers":
      return Array.from(core, (character) => character.charCodeAt(0) % 10).join(
        "",
      );
    case "letters_and_numbers":
      return (start + "0" + core + "9" + end).replace(/[^a-zA-Z0-9]/g, "");
    case "lower_letters_and_numbers":
      return (start + "0" + core + "9" + end)
        .replace(/[^a-zA-Z0-9]/g, "")
        .toLowerCase();
    case "lower_mixing":
      return (start + "_" + core + "_" + end).toLowerCase();
    default:
      return start + "_" + core + "_" + end;
  }
}

function setMasterVisibility(visible) {
  master.type = visible ? "text" : "password";
  toggleMaster.setAttribute("aria-pressed", String(visible));
  toggleMaster.setAttribute("aria-label", message("show_master"));
  toggleMaster.title = message(visible ? "hide_master" : "show_master");
  toggleMaster.firstElementChild.textContent = visible ? "🙈" : "👁";
}

toggleMaster.addEventListener("click", () => {
  setMasterVisibility(master.type === "password");
});
setMasterVisibility(false);

for (const field of [master, site]) {
  field.addEventListener("input", () => field.removeAttribute("aria-invalid"));
}

for (const field of [prefix, suffix, mode]) {
  field.addEventListener("input", () => {
    chrome.storage.local.set({ [field.id]: field.value }).catch(() => {
      setStatus("settings_failed", "error");
    });
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (configuration.disabled || submitting) return;

  const missing = [master, site].filter((field) => field.value.trim() === "");
  for (const field of missing) field.setAttribute("aria-invalid", "true");
  if (missing.length > 0) {
    setStatus("required_fields", "error");
    missing[0].focus();
    return;
  }

  let password;
  try {
    password = generatePassword(
      master.value,
      site.value,
      prefix.value,
      suffix.value,
      mode.value,
    );
  } catch {
    setStatus("generation_failed", "error");
    return;
  }

  showResult(password);

  submitting = true;
  try {
    if (fillMode) {
      const [injection] = await chrome.scripting.executeScript({
        target: {
          tabId: Number(fillRequest.get("tab")),
          documentIds: [fillRequest.get("document")],
        },
        func: (id, value) => globalThis.goodPassFill?.(id, value) ?? false,
        args: [fillRequest.get("fill"), password],
      });
      if (!injection?.result) throw new Error("Fill target unavailable");
      master.value = "";
      window.close();
    } else {
      await navigator.clipboard.writeText(password);
      setStatus("copied", "success");
    }
  } catch {
    if (fillMode) {
      master.value = "";
      configuration.disabled = true;
      setStatus("fill_failed", "error", true);
    } else {
      setStatus("copy_failed", "error");
    }
  } finally {
    submitting = false;
  }
});

async function initialize() {
  if (fillMode) {
    document.documentElement.classList.add("fill-popup");
    generate.textContent = message("generate_and_fill");
    if (!fillRequest.get("fill")) {
      setStatus("fill_failed", "error", true);
      return;
    }
  }

  const [settings, siteIdentifier] = await Promise.allSettled([
    chrome.storage.local.get({ prefix: "", suffix: "", mode: "mixing" }),
    fillMode
      ? getSiteIdentifier(fillRequest.get("origin"))
      : chrome.tabs
          .query({ active: true, currentWindow: true })
          .then(([tab]) => getSiteIdentifier(tab?.url)),
  ]);

  if (settings.status === "fulfilled") {
    prefix.value = settings.value.prefix;
    suffix.value = settings.value.suffix;
    mode.value = settings.value.mode;
    if (!mode.value) mode.value = "mixing";
  } else {
    setStatus("settings_failed", "error");
  }

  if (siteIdentifier.status === "fulfilled") site.value = siteIdentifier.value;
  configuration.disabled = false;
  master.focus();
}

void initialize();
