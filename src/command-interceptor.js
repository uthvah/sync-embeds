const { Notice } = require('obsidian');

class CommandInterceptor {
    constructor(plugin) {
        this.plugin = plugin;
        this.handlers = new Map();
        this.setupHandlers();
    }

    setupHandlers() {
        const mappings = {
            'editor:toggle-checklist-status': this.toggleChecklistCommand,
            'editor:toggle-bold': this.toggleBoldCommand,
            'editor:toggle-italics': this.toggleItalicCommand,
            'editor:toggle-strikethrough': this.toggleStrikethroughCommand,
            'editor:toggle-code': this.toggleCodeCommand,
            'editor:insert-link': this.insertLinkCommand,
            'editor:toggle-bullet-list': this.toggleBulletListCommand,
            'editor:toggle-numbered-list': this.toggleNumberedListCommand,
            'editor:indent-list': this.indentListCommand,
            'editor:unindent-list': this.unindentListCommand,
            'editor:insert-tag': this.insertTagCommand,
            'editor:swap-line-up': this.swapLineUpCommand,
            'editor:swap-line-down': this.swapLineDownCommand,
            'editor:duplicate-line': this.duplicateLineCommand,
            'editor:delete-line': this.deleteLineCommand,
            'editor:toggle-highlight': this.toggleHighlightCommand,
            'editor:insert-callout': this.insertCalloutCommand,
            // NEW: Header commands (H2-H6 only, no H1)
            'sync-embeds:insert-header-2': () => this.insertHeaderCommand(2),
            'sync-embeds:insert-header-3': () => this.insertHeaderCommand(3),
            'sync-embeds:insert-header-4': () => this.insertHeaderCommand(4),
            'sync-embeds:insert-header-5': () => this.insertHeaderCommand(5),
            'sync-embeds:insert-header-6': () => this.insertHeaderCommand(6),
        };

        for (const [commandId, handler] of Object.entries(mappings)) {
            this.handlers.set(commandId, handler.bind(this));
        }
    }

    hasHandler(commandId) {
        return this.handlers.has(commandId);
    }

    handle(commandId, embedData, ...args) {
        const handler = this.handlers.get(commandId);
        if (handler) {
            try {
                return handler(embedData, ...args);
            } catch (error) {
                console.error(`Sync Embeds: Error handling command ${commandId}:`, error);
                return false;
            }
        }
        return false;
    }

    // === CHECKLIST ===
    toggleChecklistCommand(embedData) {
        const { editor } = embedData;
        const cursor = editor.getCursor();
        const line = editor.getLine(cursor.line);

        if (line.match(/^\s*- \[ \]/)) {
            // Toggle unchecked to checked
            const newLine = line.replace(/- \[ \]/, '- [x]');
            editor.replaceRange(
                newLine,
                { line: cursor.line, ch: 0 },
                { line: cursor.line, ch: line.length }
            );
            // Move cursor to end of line (native Obsidian behavior)
            editor.setCursor({ line: cursor.line, ch: newLine.length });
        } else if (line.match(/^\s*- \[x\]/i)) {
            // Toggle checked to unchecked
            const newLine = line.replace(/- \[x\]/i, '- [ ]');
            editor.replaceRange(
                newLine,
                { line: cursor.line, ch: 0 },
                { line: cursor.line, ch: line.length }
            );
            // Move cursor to end of line
            editor.setCursor({ line: cursor.line, ch: newLine.length });
        } else {
            // Convert to checklist
            const indent = line.match(/^\s*/)[0];
            const content = line.substring(indent.length);
            const newLine = `${indent}- [ ] ${content}`;
            editor.replaceRange(
                newLine,
                { line: cursor.line, ch: 0 },
                { line: cursor.line, ch: line.length }
            );
            // Move cursor to end of line (native Obsidian behavior)
            editor.setCursor({ line: cursor.line, ch: newLine.length });
        }
        return true;
    }

    // === FORMATTING ===
    toggleMarkdownFormatting(embedData, markdownChar) {
        const { editor } = embedData;
        const selection = editor.getSelection();
        const len = markdownChar.length;

        if (selection && selection.startsWith(markdownChar) && selection.endsWith(markdownChar)) {
            // Remove formatting
            const newText = selection.slice(len, -len);
            editor.replaceSelection(newText);
            
            // Keep selection on the content
            const cursor = editor.getCursor('from');
            editor.setSelection(
                cursor,
                { line: cursor.line, ch: cursor.ch + newText.length }
            );
        } else if (selection) {
            // Add formatting around selection
            editor.replaceSelection(`${markdownChar}${selection}${markdownChar}`);
            
            // Keep the wrapped text selected
            const cursor = editor.getCursor('from');
            editor.setSelection(
                { line: cursor.line, ch: cursor.ch + len },
                { line: cursor.line, ch: cursor.ch + len + selection.length }
            );
        } else {
            // No selection: insert markers and place cursor between them
            const cursor = editor.getCursor();
            editor.replaceRange(markdownChar + markdownChar, cursor);
            editor.setCursor({ line: cursor.line, ch: cursor.ch + len });
        }
        return true;
    }

    toggleBoldCommand(embedData) {
        return this.toggleMarkdownFormatting(embedData, '**');
    }

    toggleItalicCommand(embedData) {
        return this.toggleMarkdownFormatting(embedData, '*');
    }

    toggleStrikethroughCommand(embedData) {
        return this.toggleMarkdownFormatting(embedData, '~~');
    }

    toggleCodeCommand(embedData) {
        return this.toggleMarkdownFormatting(embedData, '`');
    }

    toggleHighlightCommand(embedData) {
        return this.toggleMarkdownFormatting(embedData, '==');
    }

    // === LINKS ===
    insertLinkCommand(embedData) {
        const { editor } = embedData;
        const selection = editor.getSelection();
        
        if (selection) {
            editor.replaceSelection(`[[${selection}]]`);
        } else {
            const cursor = editor.getCursor();
            editor.replaceRange('[[]]', cursor);
            editor.setCursor({ line: cursor.line, ch: cursor.ch + 2 });
        }
        return true;
    }

    // === LISTS ===
    toggleBulletListCommand(embedData) {
        const { editor } = embedData;
        const cursor = editor.getCursor();
        const line = editor.getLine(cursor.line);

        if (line.match(/^\s*- /)) {
            // Remove bullet
            const newLine = line.replace(/^\s*- /, '');
            editor.replaceRange(
                newLine,
                { line: cursor.line, ch: 0 },
                { line: cursor.line, ch: line.length }
            );
        } else {
            // Add bullet
            const indent = line.match(/^\s*/)[0];
            const content = line.substring(indent.length);
            editor.replaceRange(
                `${indent}- ${content}`,
                { line: cursor.line, ch: 0 },
                { line: cursor.line, ch: line.length }
            );
        }
        return true;
    }

    toggleNumberedListCommand(embedData) {
        const { editor } = embedData;
        const cursor = editor.getCursor();
        const line = editor.getLine(cursor.line);

        if (line.match(/^\s*\d+\. /)) {
            // Remove numbering
            const newLine = line.replace(/^\s*\d+\. /, '');
            editor.replaceRange(
                newLine,
                { line: cursor.line, ch: 0 },
                { line: cursor.line, ch: line.length }
            );
        } else {
            // Add numbering
            const indent = line.match(/^\s*/)[0];
            const content = line.substring(indent.length);
            editor.replaceRange(
                `${indent}1. ${content}`,
                { line: cursor.line, ch: 0 },
                { line: cursor.line, ch: line.length }
            );
        }
        return true;
    }

    indentListCommand(embedData) {
        const { editor } = embedData;
        const from = editor.getCursor('from').line;
        const to = editor.getCursor('to').line;

        // Handle multiple lines if selected
        for (let line = from; line <= to; line++) {
            editor.replaceRange('\t', { line, ch: 0 });
        }
        
        return true;
    }

    unindentListCommand(embedData) {
        const { editor } = embedData;
        const from = editor.getCursor('from').line;
        const to = editor.getCursor('to').line;

        for (let line = from; line <= to; line++) {
            const lineText = editor.getLine(line);
            if (lineText.startsWith('\t')) {
                editor.replaceRange('', { line, ch: 0 }, { line, ch: 1 });
            } else if (lineText.startsWith('    ')) {
                editor.replaceRange('', { line, ch: 0 }, { line, ch: 4 });
            }
        }
        
        return true;
    }

    // === TAGS ===
    insertTagCommand(embedData) {
        const { editor } = embedData;
        const cursor = editor.getCursor();
        const selection = editor.getSelection();
        
        if (selection) {
            editor.replaceSelection(`#${selection}`);
        } else {
            editor.replaceRange('#', cursor);
        }
        return true;
    }

    // === CALLOUTS ===
    insertCalloutCommand(embedData) {
        const { editor } = embedData;
        const cursor = editor.getCursor();
        const calloutText = '> [!note]\n> ';
        
        editor.replaceRange(calloutText, cursor);
        editor.setCursor({ line: cursor.line + 1, ch: 2 });
        return true;
    }

    // === LINE OPERATIONS ===
    swapLineUpCommand(embedData) {
        const { editor } = embedData;
        const cursor = editor.getCursor();
        
        if (cursor.line > 0) {
            const currentLine = editor.getLine(cursor.line);
            const prevLine = editor.getLine(cursor.line - 1);
            
            // Use transaction for atomic operation
            editor.transaction({
                changes: [
                    {
                        from: { line: cursor.line - 1, ch: 0 },
                        to: { line: cursor.line - 1, ch: prevLine.length },
                        text: currentLine
                    },
                    {
                        from: { line: cursor.line, ch: 0 },
                        to: { line: cursor.line, ch: currentLine.length },
                        text: prevLine
                    }
                ],
                selection: { from: { line: cursor.line - 1, ch: cursor.ch } }
            });
        }
        return true;
    }

    swapLineDownCommand(embedData) {
        const { editor } = embedData;
        const cursor = editor.getCursor();
        
        if (cursor.line < editor.lastLine()) {
            const currentLine = editor.getLine(cursor.line);
            const nextLine = editor.getLine(cursor.line + 1);
            
            // Use transaction for atomic operation
            editor.transaction({
                changes: [
                    {
                        from: { line: cursor.line, ch: 0 },
                        to: { line: cursor.line, ch: currentLine.length },
                        text: nextLine
                    },
                    {
                        from: { line: cursor.line + 1, ch: 0 },
                        to: { line: cursor.line + 1, ch: nextLine.length },
                        text: currentLine
                    }
                ],
                selection: { from: { line: cursor.line + 1, ch: cursor.ch } }
            });
        }
        return true;
    }

    duplicateLineCommand(embedData) {
        const { editor } = embedData;
        const cursor = editor.getCursor();
        const line = editor.getLine(cursor.line);
        
        editor.replaceRange(`\n${line}`, { line: cursor.line, ch: line.length });
        editor.setCursor({ line: cursor.line + 1, ch: cursor.ch });
        return true;
    }

    deleteLineCommand(embedData) {
        const { editor } = embedData;
        const { line } = editor.getCursor();
        
        // Handle last line differently
        if (line === editor.lastLine()) {
            const prevLineLength = line > 0 ? editor.getLine(line - 1).length : 0;
            editor.replaceRange('', { line, ch: 0 }, { line, ch: editor.getLine(line).length });
            if (line > 0) {
                editor.replaceRange('', { line: line - 1, ch: prevLineLength }, { line, ch: 0 });
            }
        } else {
            editor.replaceRange('', { line, ch: 0 }, { line: line + 1, ch: 0 });
        }
        
        return true;
    }

    // === HEADER COMMANDS ===
    insertHeaderCommand(level) {
        return (embedData) => {
            const { editor, sectionInfo } = embedData;
            
            // Check if this is a section embed - always enforce in section embeds
            if (sectionInfo) {
                const { headerLevel } = sectionInfo;
                
                // Block same-level or higher
                if (level <= headerLevel) {
                    if (this.plugin.settings.showHeaderHints) {
                        const availableLevels = [];
                        for (let i = headerLevel + 1; i <= 6; i++) {
                            availableLevels.push(`H${i} (Alt+${i})`);
                        }
                        new Notice(
                            `⚠️ H${level} is not allowed in H${headerLevel} section.\nAvailable: ${availableLevels.join(', ')}`,
                            5000
                        );
                    }
                    return false;
                }
            }
            
            return this.insertHeader(embedData, level);
        };
    }

    insertHeader(embedData, level) {
        const { editor } = embedData;
        const from = editor.getCursor('from');
        const to = editor.getCursor('to');
        
        // Handle multi-line selection
        if (from.line !== to.line) {
            for (let line = from.line; line <= to.line; line++) {
                this.toggleLineHeader(editor, line, level);
            }
            return true;
        }
        
        // Single line
        return this.toggleLineHeader(editor, from.line, level);
    }

    toggleLineHeader(editor, lineNum, level) {
        const line = editor.getLine(lineNum);
        const cursor = editor.getCursor();
        
        // Smart behavior: Toggle if already a header
        const headerMatch = line.match(/^(\s*)(#{1,6})\s+(.*)$/);
        
        if (headerMatch) {
            const [, indent, hashes, content] = headerMatch;
            const currentLevel = hashes.length;
            
            if (currentLevel === level) {
                // Remove header formatting
                const newLine = `${indent}${content}`;
                editor.replaceRange(
                    newLine,
                    { line: lineNum, ch: 0 },
                    { line: lineNum, ch: line.length }
                );
                // Move cursor to start of content
                if (cursor.line === lineNum) {
                    editor.setCursor({ line: lineNum, ch: indent.length });
                }
            } else {
                // Change to requested level
                const newHashes = '#'.repeat(level);
                const newLine = `${indent}${newHashes} ${content}`;
                editor.replaceRange(
                    newLine,
                    { line: lineNum, ch: 0 },
                    { line: lineNum, ch: line.length }
                );
                // Keep cursor at same relative position if on this line
                if (cursor.line === lineNum) {
                    const newCursorCh = Math.min(
                        cursor.ch + (newHashes.length - hashes.length),
                        newLine.length
                    );
                    editor.setCursor({ line: lineNum, ch: newCursorCh });
                }
            }
        } else {
            // Convert line to header
            const indent = line.match(/^\s*/)[0];
            const content = line.substring(indent.length);
            const newHashes = '#'.repeat(level);
            const newLine = `${indent}${newHashes} ${content}`;
            
            editor.replaceRange(
                newLine,
                { line: lineNum, ch: 0 },
                { line: lineNum, ch: line.length }
            );
            
            // Place cursor after the hashes and space if on this line
            if (cursor.line === lineNum) {
                editor.setCursor({ 
                    line: lineNum, 
                    ch: indent.length + newHashes.length + 1 
                });
            }
        }
        
        return true;
    }
}

module.exports = CommandInterceptor;