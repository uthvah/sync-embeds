<div align="center">

# ✨ Sync Embeds for Obsidian

### The missing Notion-style synced block for Obsidian.

[![GitHub release (latest by date)](https://img.shields.io/github/v/release/uthvah/sync-embeds?style=for-the-badge)](https://github.com/uthvah/sync-embeds/releases/latest)
[![MIT License](https://img.shields.io/github/license/uthvah/sync-embeds?style=for-the-badge)](https://github.com/uthvah/sync-embeds/blob/main/LICENSE)

</div>

---

**Sync Embeds** transforms standard Obsidian embeds into live, two-way synced blocks. Edit any note or section directly from where you embed it, without ever needing to open the source file.

It's designed to feel seamless, stable, and completely native to the Obsidian experience.

![syncembed](https://github.com/user-attachments/assets/683ed4ad-c492-4df3-b7f1-cf948bd2aa80)

> *Edit any embed, anywhere, and have it instantly save to the original note.*

---

## Core Features

- 🔄 **Live Two-Way Syncing** — Edit an embed and see the changes reflected in the source note instantly. No more context switching.
- ⌨️ **Full Keyboard Shortcut Support** — The #1 limitation is solved. Use all your familiar hotkeys for checkboxes, formatting, lists, and headers, directly within an embed.
- 🎯 **Embed Specific Sections** — Isolate and edit just a single header section from a note using the standard `![[My Note#My Header]]` syntax. Perfect for managing tasks or project sections from a central dashboard.
- 🎨 **Smart Header Management** — Section embeds automatically enforce header hierarchy. Use Alt+2-6 hotkeys to insert headers with intelligent restrictions.
- 🚀 **Dynamic Patterns** — Create embeds that automatically update based on dates, times, or the current note title. Perfect for daily notes and project dashboards.
- 🎭 **Custom Display Names** — Show friendly aliases instead of raw file paths for cleaner, more readable embeds.
- ⚡ **Lightweight & Stable** — Built from the ground up to be robust, with lazy loading, smart caching, and a focus on performance.

---

## How it Works

Instead of just rendering the content, Sync Embeds creates a hidden, fully functional editor pane for the source note. It then re-parents the visual part of that editor directly into your current document. This means you are interacting with a real editor instance, providing a truly native feel.

For section embeds, an intelligent viewport system restricts editing to only the target section while maintaining full synchronization with the source file.

---

## Installation

### From Community Plugins (Recommended)

_Coming Soon! This plugin is currently awaiting review to be added to the official Community Plugins browser._

### Using BRAT (Beta)

1. Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin from the Community Plugins browser.
2. In Obsidian, go to `Settings` → `BRAT` → `Add Beta plugin`.
3. Enter `uthvah/sync-embeds` as the repository.
4. BRAT will install the plugin. Enable it under `Settings` → `Community plugins`.

### Manual Installation

1. Go to the [latest release](https://github.com/uthvah/sync-embeds/releases/latest).
2. Download the `main.js`, `manifest.json`, and `styles.css` files.
3. In your Obsidian vault, navigate to `.obsidian/plugins/`.
4. Create a new folder named `sync-embeds`.
5. Copy the downloaded files into this new folder.
6. Restart Obsidian, then enable the plugin under `Settings` → `Community plugins`.

---

## Usage

Using Sync Embeds is simple. Just wrap your standard embed syntax inside a `sync` code block.

### Basic Synced Block

Use the `sync` code block language identifier:

````markdown
```sync
![[My Note To Edit]]
```
````

### Embed a Specific Section

You can also embed just a single header section:

````markdown
```sync
![[My Note To Edit#A Specific Heading]]
```
````

### Multiple Embeds

Create dashboards by embedding multiple notes or sections:

````markdown
```sync
![[Daily Notes/2024-03-15|Today]]
![[Daily Notes/2024-03-14|Yesterday]]
![[Tasks#Inbox|My Tasks]]
```
````

### Dynamic Patterns

Create embeds that automatically adapt to the current context:

````markdown
```sync
![[Daily/{{date:YYYY-MM-DD}}|Today's Note]]
![[Tasks#{{date-7d:YYYY-MM-DD}}|Last Week's Tasks]]
![[Projects/{{title}}#Notes|Project Notes]]
```
````

**Available patterns:**
- `{{date:FORMAT}}` — Current date in any format (e.g., `YYYY-MM-DD`, `DD MMM YYYY`)
- `{{date±Xu:FORMAT}}` — Date offsets: `d` (days), `w` (weeks), `m` (months), `y` (years)
- `{{time:FORMAT}}` — Current time (e.g., `HH:mm`, `hh:mm A`)
- `{{title}}` — Current note's title

### Custom Options

Override global settings for individual embeds:

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

## Smart Features

### Header Management

Use **Alt+2** through **Alt+6** to insert or toggle headers (H2-H6):
- Press once on plain text → Convert to header
- Press again on header → Remove formatting
- Press different level → Change header level

In section embeds, header hierarchy is automatically enforced:
- **H2 section** → Only H3-H6 allowed
- **H3 section** → Only H4-H6 allowed

Typing `#` at the start of a line is intelligently blocked in section embeds to prevent hierarchy violations.

### Keyboard Shortcuts

All your favorite Obsidian shortcuts work inside embeds:
- **Ctrl/Cmd+B** — Bold
- **Ctrl/Cmd+I** — Italic
- **Ctrl/Cmd+K** — Insert link
- **Ctrl/Cmd+E** — Toggle checklist
- **Alt+2-6** — Insert headers
- And many more!

### Customization

Fine-tune appearance and behavior in **Settings → Sync Embeds**:
- Embed height and maximum height
- Gap between multiple embeds
- Properties collapse behavior
- Inline title visibility
- Focus highlighting
- Lazy loading threshold

---

## Use Cases

### Daily Note Dashboard
````markdown
```sync
![[Daily/{{date:YYYY-MM-DD}}|📅 Today]]
![[Daily/{{date-1d:YYYY-MM-DD}}|Yesterday]]
![[Tasks#{{date:YYYY-MM-DD}}|Today's Tasks]]
```
````

### Project Overview
````markdown
```sync
![[Projects/{{title}}#Overview|Summary{height:300px}]]
![[Projects/{{title}}#Tasks|Active Tasks]]
![[Projects/{{title}}#Notes|Latest Notes]]
```
````

### Meeting Notes
````markdown
```sync
![[Meetings/{{date:YYYY-MM-DD}}#Action Items|Today's Actions]]
![[Meetings/{{date-1w:YYYY-MM-DD}}#Follow-ups|Last Week]]
```
````

---

## Philosophy

The goal of Sync Embeds is to make your notes more dynamic and interconnected. It removes the friction of editing transcluded content, allowing you to build powerful dashboards, manage recurring tasks, and maintain a single source of truth for blocks of information without ever leaving the note you're working on.

---

## Contributing & Feedback

This plugin was built with and for the community. If you find a bug, have a feature idea, or want to contribute, please feel free to open an issue or submit a pull request!

- **Issues & Bug Reports:** [GitHub Issues](https://github.com/uthvah/sync-embeds/issues)
- **Feature Requests:** [GitHub Discussions](https://github.com/uthvah/sync-embeds/discussions)

---

<div align="center">

**If you find this plugin helpful, please consider starring ⭐ the repository!**

</div>
