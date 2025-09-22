const { Plugin, MarkdownView, WorkspaceLeaf, Component, debounce } = require('obsidian');

module.exports = class SyncEmbedPlugin extends Plugin {
    async onload() {
        console.log('Loading Sync Embeds Plugin');

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
    }

    onunload() {
        console.log('Unloading Sync Embeds Plugin');
    }

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

            if (!notePath) {
                notePath = ctx.sourcePath;
            }

            const file = this.app.metadataCache.getFirstLinkpathDest(notePath, ctx.sourcePath);

            if (!file) {
                this.renderError(container, `Note not found: ${notePath}`, addGap);
                return;
            }

            if (file.path === ctx.sourcePath) {
                this.renderError(container, "Cannot create a recursive embed of the same note.", addGap);
                return;
            }

            const embedContainer = container.createDiv('sync-embed');
            if (addGap) embedContainer.addClass('sync-embed-gap');

            const component = new Component();
            const leaf = new WorkspaceLeaf(this.app);
            component.load();
            component.addChild(new (class extends Component { async onunload() { leaf.detach(); } })());

            await leaf.openFile(file, { state: { mode: "source" } });
            const view = leaf.view;

            if (!(view instanceof MarkdownView)) {
                this.renderError(embedContainer, 'Failed to load a markdown view.', addGap);
                leaf.detach();
                return;
            }

            if (section) {
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
                    if (view.editor.getDoc().lineCount() > cursor.line && 
                        view.editor.getLine(cursor.line).length >= cursor.ch) {
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
                    if (modifiedFile.path === file.path && !isSaving) {
                        await loadSection();
                    }
                }));

                // --- REFINED HEADER LOGIC WITH INTUITIVE BACKSPACE ---
                let lastCorrectedLineNumber = -1; // Track which line we just auto-corrected

                component.registerEvent(this.app.workspace.on('editor-change', (editor) => {
                    if (editor !== view.editor || isProgrammaticUpdate) {
                        return;
                    }

                    const cursorPos = editor.getCursor();
                    const line = editor.getLine(cursorPos.line);
                    const currentLineNumber = cursorPos.line;

                    // Rule 1: The main section header is not editable.
                    if (currentLineNumber === 0 && line !== originalHeader) {
                        isProgrammaticUpdate = true;
                        editor.replaceRange(originalHeader, { line: 0, ch: 0 }, { line: 0, ch: line.length });
                        lastCorrectedLineNumber = -1;
                        isProgrammaticUpdate = false;
                        return;
                    }

                    // Rule 2: Enforce sub-headers and handle cancellation.
                    if (currentLineNumber > 0 && line.trim().startsWith('#')) {
                        const currentHashes = (line.match(/^#+/) || [''])[0];
                        const currentLevel = currentHashes.length;
                        const requiredLevel = headerLevel + 1;
                        const requiredHashes = '#'.repeat(requiredLevel);

                        // --- Intuitive Backspace Cancellation ---
                        // If the user just backspaced on a line we *just* auto-corrected,
                        // interpret it as "cancel" and remove the hashes entirely.
                        if (currentLineNumber === lastCorrectedLineNumber && currentLevel < requiredLevel) {
                           isProgrammaticUpdate = true;
                           editor.replaceRange("", { line: currentLineNumber, ch: 0 }, { line: currentLineNumber, ch: currentLevel });
                           isProgrammaticUpdate = false;
                           lastCorrectedLineNumber = -1; // Reset tracker
                           debouncedSave();
                           return;
                        }
                        
                        // --- Standard Sub-Header Enforcement ---
                        if (currentLevel <= headerLevel) {
                            isProgrammaticUpdate = true;
                            editor.replaceRange(requiredHashes, { line: currentLineNumber, ch: 0 }, { line: currentLineNumber, ch: currentLevel });
                            lastCorrectedLineNumber = currentLineNumber; // Track that we made a correction
                            isProgrammaticUpdate = false;
                        } else {
                            // If the line is valid, reset the tracker
                            lastCorrectedLineNumber = -1;
                        }
                    } else {
                        // If the line is no longer a header, reset the tracker
                        lastCorrectedLineNumber = -1;
                    }

                    debouncedSave();
                }));
            }

            embedContainer.appendChild(view.containerEl);
            embedContainer.style.height = 'auto';
            ctx.addChild(component);

        } catch (error) {
            console.error('Sync Embeds: Error processing embed:', error);
            this.renderError(container, `Error loading: ${error.message}`, addGap);
        }
    }

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
        let startIdx = -1;
        let sectionLevel = 0;

        for (let i = 0; i < lines.length; i++) {
            if (headerRegex.test(lines[i])) {
                startIdx = i;
                sectionLevel = (lines[i].match(/^#+/)?.[0] || '').length;
                break;
            }
        }

        if (startIdx === -1) {
            return `# ${sectionName}\n\n*Section not found.*`;
        }

        let endIdx = lines.length;
        for (let i = startIdx + 1; i < lines.length; i++) {
            const currentLevelMatch = lines[i].match(/^#+/);
            if (currentLevelMatch) {
                const currentLevel = currentLevelMatch[0].length;
                if (currentLevel <= sectionLevel) {
                    endIdx = i;
                    break;
                }
            }
        }

        return lines.slice(startIdx, endIdx).join('\n');
    }

    replaceSection(fullContent, sectionName, newSectionText) {
        const lines = fullContent.split('\n');
        const headerRegex = new RegExp(`^#{1,6}\\s+${this.escapeRegExp(sectionName)}\\s*$`);
        let startIdx = -1;
        let sectionLevel = 0;

        for (let i = 0; i < lines.length; i++) {
            if (headerRegex.test(lines[i])) {
                startIdx = i;
                sectionLevel = (lines[i].match(/^#+/)?.[0] || '').length;
                break;
            }
        }

        if (startIdx === -1) {
            return `${fullContent.trim()}\n\n${newSectionText}`.trim();
        }

        let endIdx = lines.length;
        for (let i = startIdx + 1; i < lines.length; i++) {
            const currentLevelMatch = lines[i].match(/^#+/);
            if (currentLevelMatch) {
                const currentLevel = currentLevelMatch[0].length;
                if (currentLevel <= sectionLevel) {
                    endIdx = i;
                    break;
                }
            }
        }
        
        const before = lines.slice(0, startIdx);
        const after = lines.slice(endIdx);
        const newSectionLines = newSectionText.split('\n');
        
        return [...before, ...newSectionLines, ...after].join('\n');
    }
};