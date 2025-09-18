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
            let notePath = linkText;
            let section = null;

            if (linkText.includes('#')) {
                const parts = linkText.split('#');
                notePath = parts[0];
                section = parts.slice(1).join('#');
            }

            const file = this.app.metadataCache.getFirstLinkpathDest(notePath, ctx.sourcePath);
            if (!file) {
                this.renderError(container, `Note not found: ${notePath}`, addGap);
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

            // --- SECTION LOGIC ---
            if (section) {
                let fullContent = await this.app.vault.read(file);
                const sectionContent = this.extractSection(fullContent, section);
                view.editor.setValue(sectionContent);

                // --- THE FIX ---
                // Disconnect the view from the file to prevent Obsidian's native
                // auto-save from overwriting the entire note with just the section.
                view.file = null;
                // ---------------

                const debouncedSave = debounce(async () => {
                    const newSectionText = view.editor.getValue();
                    // We must re-read the file right before saving to get the latest version.
                    const currentFullContent = await this.app.vault.read(file);
                    const newFullContent = this.replaceSection(currentFullContent, section, newSectionText);

                    if (newFullContent !== currentFullContent) {
                        await this.app.vault.modify(file, newFullContent);
                    }
                }, 500, true);

                // Register the save function on editor changes for this specific view
                component.registerEvent(this.app.workspace.on('editor-change', (editor) => {
                    if (editor === view.editor) {
                        debouncedSave();
                    }
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
        let inSection = false;
        let sectionLines = [];
        const headerRegex = new RegExp(`^#{1,6}\\s+${this.escapeRegExp(sectionName)}\\s*$`);
        let sectionLevel = 0;

        for (const line of lines) {
            if (headerRegex.test(line)) {
                inSection = true;
                sectionLevel = (line.match(/^#+/)?.[0] || '').length;
                sectionLines.push(line);
                continue;
            }

            if (inSection) {
                const currentLevelMatch = line.match(/^#+/);
                if (currentLevelMatch) {
                    const currentLevel = currentLevelMatch[0].length;
                    if (currentLevel <= sectionLevel) {
                        break;
                    }
                }
                sectionLines.push(line);
            }
        }
        return inSection ? sectionLines.join('\n') : `# ${sectionName}\n\n*Section not found.*`;
    }

    replaceSection(fullContent, sectionName, newSectionText) {
        const lines = fullContent.split('\n');
        const headerRegex = new RegExp(`^#{1,6}\\s+${this.escapeRegExp(sectionName)}\\s*$`);
        let sectionLevel = 0;
        let startIdx = -1;
        let endIdx = lines.length;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (startIdx === -1 && headerRegex.test(line)) {
                startIdx = i;
                sectionLevel = (line.match(/^#+/)?.[0] || '').length;
                continue;
            }

            if (startIdx !== -1) {
                const currentLevelMatch = line.match(/^#+/);
                if (currentLevelMatch) {
                    const currentLevel = currentLevelMatch[0].length;
                    if (currentLevel <= sectionLevel) {
                        endIdx = i;
                        break;
                    }
                }
            }
        }

        if (startIdx === -1) {
            return `${fullContent}\n\n${newSectionText}`;
        }

        const before = lines.slice(0, startIdx);
        const after = lines.slice(endIdx);
        const newSectionLines = newSectionText.split('\n');
        return [...before, ...newSectionLines, ...after].join('\n');
    }
};