const { Plugin, MarkdownView, WorkspaceLeaf, Component, debounce } = require('obsidian');

module.exports = class SyncEmbedPlugin extends Plugin {
    constructor(app, manifest) {
        super(app, manifest);
        this.embedRegistry = new Map(); // Maps container elements to embed data
        this.originalExecuteCommand = null;
        this.originalGetActiveViewOfType = null;
        this.commandInterceptors = new Map(); // Maps command IDs to our handlers
        this.currentFocusedEmbed = null;
    }

    async onload() {
        console.log('Loading Sync Embeds Plugin - Command Interception Active');
        
        this.hijackObsidianCommands();
        
        // Setup command interceptors for common shortcuts
        this.setupCommandInterceptors();

        this.addCommand({
            id: 'insert-synced-embed',
            name: 'Insert synced embed',
            editorCallback: (editor, view) => {
                const selection = editor.getSelection();
                const noteName = selection || 'Note Name';
                const textToInsert = `\`\`\`sync\n![[${noteName}]]\n\`\`\``;
                editor.replaceSelection(textToInsert);
            }
        });

        this.registerMarkdownCodeBlockProcessor('sync', (source, el, ctx) => {
            this.processSyncBlock(source, el, ctx);
        });

        // Global event listeners to track focus
        this.registerDomEvent(document, 'focusin', this.trackFocus.bind(this));
        this.registerDomEvent(document, 'focusout', this.trackFocusLoss.bind(this));
    }

    onunload() {
        console.log('Unloading Sync Embeds Plugin');
        this.restoreObsidianCommands();
        this.embedRegistry.clear();
        this.currentFocusedEmbed = null;
    }

    // HIJACK OBSIDIAN'S COMMAND SYSTEM
    hijackObsidianCommands() {
        this.originalExecuteCommand = this.app.commands.executeCommand;
        this.originalGetActiveViewOfType = this.app.workspace.getActiveViewOfType;

        // Override executeCommand to route to our embeds when appropriate
        this.app.commands.executeCommand = (command, ...args) => {
            const focusedEmbed = this.getFocusedEmbed();
            
            if (focusedEmbed && this.commandInterceptors.has(command.id)) {
                // Route to our custom handler
                const handler = this.commandInterceptors.get(command.id);
                return handler.call(this, focusedEmbed, ...args);
            }
            
            // Otherwise, use the default Obsidian behavior
            return this.originalExecuteCommand.call(this.app.commands, command, ...args);
        };

        // Override getActiveViewOfType to make Obsidian think our embed is the active view
        this.app.workspace.getActiveViewOfType = (type) => {
            const focusedEmbed = this.getFocusedEmbed();
            if (focusedEmbed && focusedEmbed.view instanceof type) {
                return focusedEmbed.view;
            }
            return this.originalGetActiveViewOfType.call(this.app.workspace, type);
        };
    }

    restoreObsidianCommands() {
        if (this.originalExecuteCommand) {
            this.app.commands.executeCommand = this.originalExecuteCommand;
        }
        if (this.originalGetActiveViewOfType) {
            this.app.workspace.getActiveViewOfType = this.originalGetActiveViewOfType;
        }
    }

    // SETUP COMMAND INTERCEPTORS
    setupCommandInterceptors() {
        const commandMappings = {
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
            'editor:delete-line': this.deleteLineCommand
        };

        for (const [commandId, handler] of Object.entries(commandMappings)) {
            this.commandInterceptors.set(commandId, handler);
        }
    }

    // FOCUS TRACKING METHODS
    trackFocus(event) {
        const embed = this.getEmbedFromElement(event.target);
        if (embed) {
            this.currentFocusedEmbed = embed;
        }
    }

    trackFocusLoss(event) {
        const embed = this.getEmbedFromElement(event.relatedTarget);
        if (!embed) {
            this.currentFocusedEmbed = null;
        }
    }

    // UTILITY METHODS
    getFocusedEmbed() {
        return this.currentFocusedEmbed;
    }

    getEmbedFromElement(element) {
        if (!element) return null;
        let current = element;
        while (current && current !== document.body) {
            if (current.classList && current.classList.contains('sync-embed')) {
                return this.embedRegistry.get(current);
            }
            current = current.parentElement;
        }
        return null;
    }

    // COMMAND IMPLEMENTATIONS
    toggleChecklistCommand(embedData) {
        const { editor } = embedData;
        const cursor = editor.getCursor();
        const line = editor.getLine(cursor.line);

        if (line.match(/^\s*- \[ \]/)) {
            editor.replaceRange(line.replace(/- \[ \]/, '- [x]'), {line: cursor.line, ch: 0}, {line: cursor.line, ch: line.length});
        } else if (line.match(/^\s*- \[x\]/i)) {
            editor.replaceRange(line.replace(/- \[x\]/i, '- [ ]'), {line: cursor.line, ch: 0}, {line: cursor.line, ch: line.length});
        } else {
            const indent = line.match(/^\s*/)[0];
            const content = line.substring(indent.length);
            editor.replaceRange(`${indent}- [ ] ${content}`, {line: cursor.line, ch: 0}, {line: cursor.line, ch: line.length});
        }
        return true;
    }
    
    // Helper for toggling markdown formatting
    toggleMarkdownFormatting(embedData, markdownChar) {
        const { editor } = embedData;
        const selection = editor.getSelection();
        const len = markdownChar.length;

        if (selection && selection.startsWith(markdownChar) && selection.endsWith(markdownChar)) {
            editor.replaceSelection(selection.slice(len, -len));
        } else if (selection) {
            editor.replaceSelection(`${markdownChar}${selection}${markdownChar}`);
        } else {
            const cursor = editor.getCursor();
            editor.replaceRange(markdownChar + markdownChar, cursor);
            editor.setCursor({ line: cursor.line, ch: cursor.ch + len });
        }
        return true;
    }
    
    toggleBoldCommand(embedData) { return this.toggleMarkdownFormatting(embedData, '**'); }
    toggleItalicCommand(embedData) { return this.toggleMarkdownFormatting(embedData, '*'); }
    toggleStrikethroughCommand(embedData) { return this.toggleMarkdownFormatting(embedData, '~~'); }
    toggleCodeCommand(embedData) { return this.toggleMarkdownFormatting(embedData, '`'); }

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

    toggleBulletListCommand(embedData) {
        const { editor } = embedData;
        const cursor = editor.getCursor();
        const line = editor.getLine(cursor.line);

        if (line.match(/^\s*- /)) {
            editor.replaceRange(line.replace(/^\s*- /, ''), {line: cursor.line, ch: 0}, {line: cursor.line, ch: line.length});
        } else {
            editor.replaceRange(`- ${line}`, {line: cursor.line, ch: 0}, {line: cursor.line, ch: line.length});
        }
        return true;
    }

    toggleNumberedListCommand(embedData) {
        const { editor } = embedData;
        const cursor = editor.getCursor();
        const line = editor.getLine(cursor.line);

        if (line.match(/^\s*\d+\. /)) {
            editor.replaceRange(line.replace(/^\s*\d+\. /, ''), {line: cursor.line, ch: 0}, {line: cursor.line, ch: line.length});
        } else {
            editor.replaceRange(`1. ${line}`, {line: cursor.line, ch: 0}, {line: cursor.line, ch: line.length});
        }
        return true;
    }

    indentListCommand(embedData) {
        const { editor } = embedData;
        const cursor = editor.getCursor();
        editor.replaceRange('\t', {line: cursor.line, ch: 0});
        return true;
    }

    unindentListCommand(embedData) {
        const { editor } = embedData;
        const cursor = editor.getCursor();
        const line = editor.getLine(cursor.line);
        if (line.startsWith('\t')) {
            editor.replaceRange('', {line: cursor.line, ch: 0}, {line: cursor.line, ch: 1});
        }
        return true;
    }

    insertTagCommand(embedData) {
        const { editor } = embedData;
        editor.replaceSelection('#');
        return true;
    }

    swapLineUpCommand(embedData) {
        const { editor } = embedData;
        const cursor = editor.getCursor();
        if (cursor.line > 0) {
            const currentLine = editor.getLine(cursor.line);
            const prevLine = editor.getLine(cursor.line - 1);
            editor.transaction({
                changes: [
                    { from: {line: cursor.line - 1, ch: 0}, to: {line: cursor.line - 1, ch: prevLine.length}, text: currentLine },
                    { from: {line: cursor.line, ch: 0}, to: {line: cursor.line, ch: currentLine.length}, text: prevLine }
                ],
                selection: { from: {line: cursor.line - 1, ch: cursor.ch} }
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
            editor.transaction({
                changes: [
                    { from: {line: cursor.line, ch: 0}, to: {line: cursor.line, ch: currentLine.length}, text: nextLine },
                    { from: {line: cursor.line + 1, ch: 0}, to: {line: cursor.line + 1, ch: nextLine.length}, text: currentLine }
                ],
                selection: { from: {line: cursor.line + 1, ch: cursor.ch} }
            });
        }
        return true;
    }
    
    duplicateLineCommand(embedData) {
        const { editor } = embedData;
        const cursor = editor.getCursor();
        const line = editor.getLine(cursor.line);
        editor.replaceRange(`\n${line}`, {line: cursor.line, ch: line.length});
        return true;
    }

    deleteLineCommand(embedData) {
        const { editor } = embedData;
        const { line } = editor.getCursor();
        editor.replaceRange('', {line: line, ch: 0}, {line: line + 1, ch: 0});
        return true;
    }


    // MAIN PROCESSING METHODS
    async processSyncBlock(source, el, ctx) {
        el.empty();
        const syncContainer = el.createDiv('sync-container');
        const embedLines = source.split('\n').map(line => line.trim()).filter(line => line.startsWith('![[') && line.endsWith(']]'));

        if (embedLines.length === 0) {
            syncContainer.createDiv('sync-empty').setText('No embeds found in sync block');
            return;
        }

        for (let i = 0; i < embedLines.length; i++) {
            await this.processEmbed(embedLines[i], syncContainer, ctx, i > 0);
        }
    }

    async processEmbed(embedLine, container, ctx, addGap) {
        try {
            const match = embedLine.match(/!\[\[([^\]]+)\]\]/);
            if (!match) return;

            const linkText = match[1];
            const linkPath = linkText.split('|')[0].trim();
            let notePath = linkPath.split('#')[0];
            const section = linkPath.includes('#') ? linkPath.substring(linkPath.indexOf('#') + 1) : null;

            if (!notePath) notePath = ctx.sourcePath;

            const file = this.app.metadataCache.getFirstLinkpathDest(notePath, ctx.sourcePath);
            if (!file) { this.renderError(container, `Note not found: ${notePath}`, addGap); return; }
            if (file.path === ctx.sourcePath) { this.renderError(container, "Cannot create a recursive embed of the same note.", addGap); return; }

            const embedContainer = container.createDiv('sync-embed');
            if (addGap) embedContainer.addClass('sync-embed-gap');

            const component = new Component();
            const leaf = new WorkspaceLeaf(this.app);
            component.load();
            
            component.addChild(new (class extends Component { 
                constructor(plugin, containerEl) {
                    super();
                    this.plugin = plugin;
                    this.containerEl = containerEl;
                }
                async onunload() { 
                    this.plugin.embedRegistry.delete(this.containerEl);
                    if (this.plugin.currentFocusedEmbed && this.plugin.currentFocusedEmbed.containerEl === this.containerEl) {
                        this.plugin.currentFocusedEmbed = null;
                    }
                    leaf.detach(); 
                } 
            })(this, embedContainer));

            await leaf.openFile(file, { state: { mode: "source" } });
            const view = leaf.view;

            if (!(view instanceof MarkdownView)) {
                this.renderError(embedContainer, 'Failed to load a markdown view.', addGap);
                leaf.detach();
                return;
            }

            const embedData = { view, editor: view.editor, containerEl: embedContainer, file, section, component };
            this.embedRegistry.set(embedContainer, embedData);

            if (section) {
                await this.setupSectionEmbed(embedData);
            }

            embedContainer.appendChild(view.containerEl);
            embedContainer.style.height = 'auto';
            ctx.addChild(component);

        } catch (error) {
            console.error('Sync Embeds: Error processing embed:', error);
            this.renderError(container, `Error loading: ${error.message}`, addGap);
        }
    }

    async setupSectionEmbed(embedData) {
        const { view, file, section, component } = embedData;
        
        let isProgrammaticUpdate = false;
        let isSaving = false;
        let originalHeader = "";
        let headerLevel = 0;

        const updateHeaderState = (content) => {
            originalHeader = content.split('\n')[0] || '';
            headerLevel = (originalHeader.match(/^#+/)?.[0] || '#').length;
        };

        const loadSection = async () => {
            isProgrammaticUpdate = true;
            const fileContent = await this.app.vault.read(file);
            const currentSectionContent = this.extractSection(fileContent, section);
            updateHeaderState(currentSectionContent);
            const cursor = view.editor.getCursor();
            view.editor.setValue(currentSectionContent);
            if (view.editor.getDoc().lineCount() > cursor.line && view.editor.getLine(cursor.line).length >= cursor.ch) {
                view.editor.setCursor(cursor);
            }
            setTimeout(() => isProgrammaticUpdate = false, 50);
        };
        
        await loadSection();
        view.file = null;

        const debouncedSave = debounce(async () => {
            if (isSaving) return;
            isSaving = true;
            const newEmbedContent = view.editor.getValue();
            const currentFileContent = await this.app.vault.read(file);
            const newFileContent = this.replaceSection(currentFileContent, section, newEmbedContent);
            if (newFileContent !== currentFileContent) {
                await this.app.vault.modify(file, newFileContent);
            }
            isSaving = false;
        }, 750, true);

        component.registerEvent(this.app.vault.on('modify', async (modifiedFile) => {
            if (modifiedFile.path === file.path && !isSaving) await loadSection();
        }));

        let lastCorrectedLineNumber = -1;
        component.registerEvent(this.app.workspace.on('editor-change', (editor) => {
            if (editor !== view.editor || isProgrammaticUpdate) return;
            const cursorPos = editor.getCursor();
            const line = editor.getLine(cursorPos.line);
            const currentLineNumber = cursorPos.line;

            if (currentLineNumber === 0 && line !== originalHeader) {
                isProgrammaticUpdate = true;
                editor.replaceRange(originalHeader, { line: 0, ch: 0 }, { line: 0, ch: line.length });
                isProgrammaticUpdate = false;
                return;
            }

            if (currentLineNumber > 0 && line.trim().startsWith('#')) {
                const currentHashes = (line.match(/^#+/) || [''])[0];
                const currentLevel = currentHashes.length;
                const requiredLevel = headerLevel + 1;
                const requiredHashes = '#'.repeat(requiredLevel);

                if (currentLineNumber === lastCorrectedLineNumber && currentLevel < requiredLevel) {
                   isProgrammaticUpdate = true;
                   editor.replaceRange("", { line: currentLineNumber, ch: 0 }, { line: currentLineNumber, ch: currentLevel });
                   isProgrammaticUpdate = false;
                   lastCorrectedLineNumber = -1;
                   debouncedSave();
                   return;
                }
                
                if (currentLevel <= headerLevel) {
                    isProgrammaticUpdate = true;
                    editor.replaceRange(requiredHashes, { line: currentLineNumber, ch: 0 }, { line: currentLineNumber, ch: currentLevel });
                    lastCorrectedLineNumber = currentLineNumber;
                    isProgrammaticUpdate = false;
                } else { lastCorrectedLineNumber = -1; }
            } else { lastCorrectedLineNumber = -1; }

            debouncedSave();
        }));
    }

    // UTILITY AND SECTION HELPERS
    renderError(container, message, addGap) {
        const errorDiv = container.createDiv('sync-embed-error');
        if (addGap) errorDiv.addClass('sync-embed-gap');
        errorDiv.setText(message);
    }

    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    extractSection(content, sectionName) {
        const lines = content.split('\n');
        const headerRegex = new RegExp(`^#{1,6}\\s+${this.escapeRegExp(sectionName)}\\s*$`);
        let startIdx = -1, sectionLevel = 0;

        for (let i = 0; i < lines.length; i++) {
            if (headerRegex.test(lines[i])) {
                startIdx = i;
                sectionLevel = (lines[i].match(/^#+/)?.[0] || '').length;
                break;
            }
        }
        if (startIdx === -1) return `# ${sectionName}\n\n*Section not found.*`;
        
        let endIdx = lines.length;
        for (let i = startIdx + 1; i < lines.length; i++) {
            const match = lines[i].match(/^#+/);
            if (match && match[0].length <= sectionLevel) {
                endIdx = i;
                break;
            }
        }
        return lines.slice(startIdx, endIdx).join('\n');
    }

    replaceSection(fullContent, sectionName, newSectionText) {
        const lines = fullContent.split('\n');
        const headerRegex = new RegExp(`^#{1,6}\\s+${this.escapeRegExp(sectionName)}\\s*$`);
        let startIdx = -1, sectionLevel = 0;

        for (let i = 0; i < lines.length; i++) {
            if (headerRegex.test(lines[i])) {
                startIdx = i;
                sectionLevel = (lines[i].match(/^#+/)?.[0] || '').length;
                break;
            }
        }
        if (startIdx === -1) return `${fullContent.trim()}\n\n${newSectionText}`.trim();
        
        let endIdx = lines.length;
        for (let i = startIdx + 1; i < lines.length; i++) {
            const match = lines[i].match(/^#+/);
            if (match && match[0].length <= sectionLevel) {
                endIdx = i;
                break;
            }
        }
        
        const before = lines.slice(0, startIdx);
        const after = lines.slice(endIdx);
        return [...before, ...newSectionText.split('\n'), ...after].join('\n');
    }
};