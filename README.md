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

## Core Features

*   🔄 **Live Two-Way Syncing:** Edit an embed and see the changes reflected in the source note instantly. No more context switching.
*   ⌨️ **Full Keyboard Shortcut Support:** The #1 limitation is solved. Use all your familiar hotkeys for checkboxes, formatting, lists, and more, directly within an embed.
*   🎯 **Embed Specific Sections:** Isolate and edit just a single header section from a note using the standard `![[My Note#My Header]]` syntax. Perfect for managing tasks or project sections from a central dashboard.
*   🚀 **Lightweight & Stable:** Built from the ground up to be robust, with a focus on stability and a seamless user experience.

## How it Works

Instead of just rendering the content, Sync Embeds creates a hidden, fully functional editor pane for the source note. It then re-parents the visual part of that editor directly into your current document. This means you are interacting with a real editor instance, providing a truly native feel.

---

## Installation

### From Community Plugins (Recommended)

_Coming Soon! This plugin is currently awaiting review to be added to the official Community Plugins browser._

### Using BRAT (Beta)

1.  Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin from the Community Plugins browser.
2.  In Obsidian, go to `Settings` -> `BRAT` -> `Add Beta plugin`.
3.  Enter `uthvah/sync-embeds` as the repository.
4.  BRAT will install the plugin. Enable it under `Settings` -> `Community plugins`.

### Manual Installation

1.  Go to the [latest release](https://github.com/uthvah/sync-embeds/releases/latest).
2.  Download the `main.js`, `manifest.json`, and `styles.css` files.
3.  In your Obsidian vault, navigate to `.obsidian/plugins/`.
4.  Create a new folder named `sync-embeds`.
5.  Copy the downloaded files into this new folder.
6.  Restart Obsidian, then enable the plugin under `Settings` -> `Community plugins`.

---

## Usage

Using Sync Embeds is simple. Just wrap your standard embed syntax inside a `sync` code block.

#### 1. Create a Synced Block

Use the `sync` code block language identifier:

```sync
![[My Note To Edit]]
```

2. Embed a Specific Section

You can also embed just a single header section:

```sync
![[My Note To Edit#A Specific Heading]]
```

The content within this block will now be a live, editable instance of the source note or section.

## Philosophy

The goal of Sync Embeds is to make your notes more dynamic and interconnected. It removes the friction of editing transcluded content, allowing you to build powerful dashboards, manage recurring tasks, and maintain a single source of truth for blocks of information without ever leaving the note you're working on.

## Contributing & Feedback

This plugin was built with and for the community. If you find a bug, have a feature idea, or want to contribute, please feel free to open an issue or submit a pull request!
