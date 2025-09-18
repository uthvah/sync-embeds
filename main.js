const { Plugin, MarkdownView, WorkspaceLeaf, Component } = require('obsidian');

module.exports = class SyncEmbedPlugin extends Plugin {
    async onload() {
        console.log('Loading Sync Embeds Plugin');

        // Add the command to insert a sync block.
        this.addCommand({
            id: 'insert-synced-embed',
            name: 'Insert synced embed',
            editorCallback: (editor, view) => {
                const selection = editor.getSelection();
                // If the user has selected text, use it as the note name.
                const noteName = selection || ' ';
                const textToInsert = `\`\`\`sync\n![[${noteName}]]\n\`\`\``;
                editor.replaceSelection(textToInsert);
            }
        });

        // Register the main code block processor.
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

        const embedLines = source.split('\n')
            .map(line => line.trim())
            .filter(line => line.startsWith('![[') && line.endsWith(']]'));

        if (embedLines.length === 0) {
            syncContainer.createDiv('sync-empty').setText('No embeds found in sync block');
            return;
        }

        for (let i = 0; i < embedLines.length; i++) {
            const embedLine = embedLines[i];
            await this.processEmbed(embedLine, syncContainer, ctx, i > 0);
        }
    }

    async processEmbed(embedLine, container, ctx, addGap = false) {
        try {
            const match = embedLine.match(/!\[\[([^\]]+)\]\]/);
            if (!match) return;

            const linkText = match[1];
            const notePath = linkText.split('#')[0];

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
            component.addChild(new (class extends Component {
                async onunload() {
                    leaf.detach();
                }
            })());

            await leaf.openFile(file, { state: { mode: "source" } });

            const view = leaf.view;
            if (!(view instanceof MarkdownView)) {
                this.renderError(embedContainer, 'Failed to load a markdown view.', addGap);
                leaf.detach();
                return;
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
};