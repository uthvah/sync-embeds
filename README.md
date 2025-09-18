# Sync Embeds for Obsidian

A simple, powerful plugin to create fully editable, live-synced note embeds. Edit your notes from anywhere, seamlessly.

![sync-embeds](https://github.com/user-attachments/assets/602671d5-127b-401e-8025-dfea783af134)

---

## Features

-   **Truly Native Editing**: Embeds are not a simulation. They are the actual Obsidian editor, so everything from syntax highlighting to inline rendering works as expected.
-   **Live Two-Way Sync**: Changes made in an embed are instantly reflected in the original note, and vice-versa.
-   **Seamless Look & Feel**: Embeds blend perfectly into your notes with no distracting borders or titles.
-   **Simple to Use**: Just place a note link inside a `sync` code block.

## How to Use

There are two ways to create a synced embed:

### 1. Manual Method

Wrap one or more standard Obsidian embeds inside a `sync` code block.

````markdown
```sync
![[My Note To Edit]]
![[Another Note]]
```
````

The code block will be replaced with a live, editable version of "My Note To Edit" and "Another Note".

### 2. Command Palette

1.  Open the Command Palette (`Ctrl+P` or `Cmd+P`).
2.  Search for **"Sync Embeds: Insert synced embed"**.
3.  A `sync` block will be inserted at your cursor's position. If you have text selected, it will be used as the note name.

## Important Limitation: Keyboard Shortcuts

Please be aware that most keyboard shortcuts and editor commands **will not work** when you are focused on a synced embed.

**Why?** Obsidian's commands and hotkeys are tied to the main "active" editor pane. When you are editing an embed, the parent note is still considered the active file. This is a technical limitation of how embedded editors work within the app.

Basic text editing, typing, and selection work perfectly.

## Installation

Copy over main.js, manifest.json and styles.css from the latest release to your vault @ VaultFolder/.obsidian/plugins/sync-embeds/.
