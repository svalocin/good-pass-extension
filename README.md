# Good Pass

A Chrome extension that generates site-specific passwords from a master password — locally, deterministically, and without uploading or storing your secrets.

## Features

- **Local-only generation** — passwords never leave your browser
- **Deterministic** — the same master password, site, prefix, suffix, and mode always produce the same result
- **Auto site detection** — fills the site identifier from the current tab
- **Generate and copy** — one click copies the password to the clipboard
- **Context-menu fill** — right-click an editable field and choose **Good Pass** to generate and fill it
- **Multiple modes** — mixed, lowercase mixed, letters & numbers, lowercase letters & numbers, or numbers only
- **Optional prefix / suffix** — adapt to site password rules
- **Multi-language UI** — English, Chinese (Simplified / Traditional), Japanese, Korean, German, French, Spanish

## Install

1. Clone or download this repository
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked** and select this project folder

Requires Chrome 106 or later (Manifest V3).

## Usage

1. Open the extension popup (or right-click a password/text field → **Good Pass**)
2. Enter your **master password**
3. Confirm the **site identifier** (usually auto-filled)
4. Optionally set prefix, suffix, and mode
5. Click **Generate and Copy** (or **Generate and Fill** in fill mode)

Prefix, suffix, and mode are saved locally in `chrome.storage.local`. The master password is never stored.

## How it works

Good Pass derives a short core hash from your master password and site identifier, then formats it according to the selected mode:

```text
MD5("GP" + MASTER + SITE) → 8-character core → mode formatting (+ optional prefix/suffix)
```

Inputs are sanitized (whitespace removed, uppercased) before hashing. The algorithm is intentionally stable so existing passwords keep working.

## Privacy

- Generation runs entirely on-device
- Master passwords are not persisted
- No network requests for password generation
- Only prefix, suffix, and mode preferences are stored locally

## Permissions

| Permission     | Why                                             |
| -------------- | ----------------------------------------------- |
| `activeTab`    | Read the current tab URL for site detection     |
| `storage`      | Save prefix, suffix, and mode preferences       |
| `contextMenus` | Add the right-click fill action                 |
| `scripting`    | Inject a short helper to fill the focused field |

## Project layout

```text
├── manifest.json      # Extension manifest (MV3)
├── background.js      # Context menu & fill popup
├── popup.html/css/js  # Generator UI
├── _locales/          # i18n message catalogs
├── icons/             # Extension icons
└── vendor/            # Bundled libraries (md5, tldts)
```

## License

[MIT](LICENSE)

Copyright (c) 2019 Slyerr Huang

This project includes [JavaScript MD5](https://blueimp.net) by Sebastian Tschan (MIT) and [tldts](https://github.com/remusao/tldts) for domain parsing.
