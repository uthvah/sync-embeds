
<div align="center">

# ✨ Sync Embeds for Obsidian

### The missing Notion-style synced block for Obsidian.

[![Obsidian Plugin](https://img.shields.io/badge/Available_in-Community_Store-7A367A?style=for-the-badge&logo=obsidian)](#installation)
[![GitHub release (latest by date)](https://img.shields.io/github/v/release/uthvah/sync-embeds?style=for-the-badge)](https://github.com/uthvah/sync-embeds/releases/latest)
[![MIT License](https://img.shields.io/github/license/uthvah/sync-embeds?style=for-the-badge)](https://github.com/uthvah/sync-embeds/blob/main/LICENSE)

</div>

---

**Sync Embeds** transforms standard Obsidian transclusions into live, editable, two-way synced blocks. Edit any note (or specific header section) directly from where you embed it, without ever needing to open the source file.

Trusted by over 15,000 users, it's designed to feel seamless, stable, and completely native to the Obsidian experience.

https://github.com/user-attachments/assets/68d20937-b4a0-4790-9aa8-34f670e42893

> *Edit any embed, anywhere, and have it instantly save to the original note.*

---

## Core Features

- 🔄 **Live "Two-Way Syncing"** — Edit an embed and see the changes reflected in the source note instantly. No "saving," no lag, no context switching.
- ⌨️ **Full Keyboard Shortcut Support** — The #1 limitation of native embeds is solved. Use all your familiar hotkeys for checkboxes (`Ctrl/Cmd+L`), formatting (`Ctrl/Cmd+B/I`), lists, and headers, directly within an embed.
- 🎯 **Section & Header Embeds** — Isolate and edit just a single section from a note using the standard `![[My Note#My Header]]` syntax. Perfect for managing active tasks from a central dashboard.
- 🚀 **Dynamic Patterns (For Daily Notes)** — Create embeds that automatically update based on dates or note titles (e.g., `{{date}}`). 
- 🎨 **Smart Header Management** — Section embeds intelligently enforce header hierarchy to prevent your markdown structure from breaking.
- 🎭 **Custom Display Names** — Show friendly aliases instead of raw file paths for cleaner, more readable page elements.

---

## How it Works

Instead of just rendering a read-only preview, Sync Embeds creates a hidden, fully functional editor pane for the source note. It then seamlessly "re-parents" the visual part of that editor directly into your current document. 

This means you are interacting with a *real* editor instance. When editing a specific section, an intelligent viewport system restricts editing to only the target header while maintaining full synchronization with the source file.

---

## Installation

### From Community Plugins (Recommended)

Sync Embeds is officially available in the Obsidian Community Store!

1. Open Obsidian **Settings** → **Community Plugins**.
2. Click **Browse** and search for `Sync Embeds`.
3. Click **Install**, then **Enable**.

### Manual Installation (GitHub)
1. Go to the [latest release](https://github.com/uthvah/sync-embeds/releases/latest).
2. Download `main.js`, `manifest.json`, and `styles.css`.
3. In your Obsidian vault, navigate to `.obsidian/plugins/`.
4. Create a new folder named `sync-embeds` and paste the downloaded files inside.
5. Restart Obsidian, then enable the plugin under **Settings** → **Community plugins**.

---

## Usage

Using Sync Embeds is simple. Wrap your standard embed syntax inside a `sync` code block.

### Basic Synced Block

````markdown
```sync
![[My Note To Edit]]
```
````

### Embed a Specific Section

Isolate and edit a specific header:

````markdown
```sync
![[Project Alpha#Active Tasks]]
```
````

### Dynamic Patterns (Automations)

Create embeds that automatically adapt to the current context. Perfect for templating!

````markdown
```sync
![[Daily/{{date:YYYY-MM-DD}}|Today's Note]]
![[Tasks#{{date-7d:YYYY-MM-DD}}|Last Week's Tasks]]
![[Projects/{{title}}#Notes|Project Notes]]
```
````

**Available dynamic variables:**
- `{{date:FORMAT}}` — Current date (e.g., `YYYY-MM-DD`, `DD MMM YYYY`)
- `{{date±Xu:FORMAT}}` — Date offsets: `d` (days), `w` (weeks), `m` (months), `y` (years)
- `{{time:FORMAT}}` — Current time (e.g., `HH:mm`, `hh:mm A`)
- `{{title}}` — Current note's title

### Custom Options

Override global settings for individual embeds right in the alias:

````markdown
```sync
![[Long Note|Compact View{height:300px}]]
![[Reference|Full Height{maxHeight:none,title:false}]]
```
````

**Available options:**
- `height` — Set fixed height (e.g., `400px`, `60vh`)
- `maxHeight` — Set maximum height before scrolling
- `title` — Show/hide title (`true` or `false`)

---

## Use Cases & Inspiration

### 1. The Daily Note Dashboard
Keep your daily note clean while managing recurring items:
````markdown
```sync
![[Daily/{{date:YYYY-MM-DD}}|📅 Today]]
![[Daily/{{date-1d:YYYY-MM-DD}}|Yesterday]]
![[Master Tasks#{{date:YYYY-MM-DD}}|Today's Tasks]]
```
````

### 2. The Project Overview
View and edit different parts of a large project from a single pane:
````markdown
```sync
![[Projects/{{title}}#Overview|Summary{height:300px}]]
![[Projects/{{title}}#Tasks|Active Tasks]]
![[Projects/{{title}}#Notes|Latest Notes]]
```
````

---

## Contributing & Feedback

This plugin was built with and for the community. If you find a bug, have a feature idea, or want to contribute, please feel free to open an issue or submit a pull request!

- **Issues & Bug Reports:** [GitHub Issues](https://github.com/uthvah/sync-embeds/issues)
- **Feature Requests:** [GitHub Discussions](https://github.com/uthvah/sync-embeds/discussions)

---

<div align="center">

### Support Development

Sync Embeds is provided entirely for free. If this plugin has improved your workflow or saved you time, consider supporting its continued development! 

<a href="https://ko-fi.com/uthvah" target="_blank"><img src="https://cdn.ko-fi.com/cdn/kofi3.png?v=3" alt="Buy Me A Coffee" height="35" width="130"></a>

**Leave a ⭐ on the repository, if you like!!**

</div>
