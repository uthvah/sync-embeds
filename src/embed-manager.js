const { Component, WorkspaceLeaf, MarkdownView, setIcon } = require('obsidian');
const ViewportController = require('./viewport-controller');
const DynamicPaths = require('./dynamic-paths');

class EmbedManager {
    constructor(plugin) {
        this.plugin = plugin;
        this.embedRegistry = new WeakMap();
        this.activeEmbeds = new Set();
        this.viewportController = new ViewportController(plugin);
        this.dynamicPaths = new DynamicPaths(plugin);
    }

    cleanup() {
        this.activeEmbeds.forEach(embedData => {
            if (embedData.component) embedData.component.unload();
            if (embedData.leaf) embedData.leaf.detach();
        });
        this.activeEmbeds.clear();
        if (this.dynamicPaths) this.dynamicPaths.cleanup();
    }

    getEmbedFromElement(element) {
        if (!element) return null;
        let current = element;
        while (current && current !== document.body) {
            if (current.classList && current.classList.contains('sync-embed')) {
                const embedData = this.embedRegistry.get(current);
                if (embedData) return embedData;
            }
            current = current.parentElement;
        }
        return null;
    }

    async processSyncBlock(source, el, ctx) {
        el.empty();
        const syncContainer = el.createDiv('sync-container');

        syncContainer.style.setProperty('--sync-embed-height', this.plugin.settings.embedHeight);
        syncContainer.style.setProperty('--sync-max-height', this.plugin.settings.maxEmbedHeight);
        syncContainer.style.setProperty('--sync-gap', this.plugin.settings.gapBetweenEmbeds);

        const embedLines = source.split('\n')
            .map(line => line.trim())
            .filter(line => line.startsWith('![[') && line.endsWith(']]'));

        if (embedLines.length === 0) {
            syncContainer.createDiv('sync-empty').setText('No embeds found in sync block');
            return;
        }

        const estimatedHeight = embedLines.length * 200;
        syncContainer.style.minHeight = `${estimatedHeight}px`;

        for (let i = 0; i < embedLines.length; i++) {
            await this.processEmbed(embedLines[i], syncContainer, ctx, i > 0);
        }

        setTimeout(() => { syncContainer.style.minHeight = ''; }, 100);
    }

    parseEmbedOptions(line) {
        const optionsMatch = line.match(/\{([^}]+)\}\]\]$/);
        const options = {};
        if (optionsMatch) {
            const optionsStr = optionsMatch[1];
            const pairs = optionsStr.split(',');
            pairs.forEach(pair => {
                const [key, value] = pair.split(':').map(s => s.trim());
                if (key && value !== undefined) {
                    if (value === 'true') options[key] = true;
                    else if (value === 'false') options[key] = false;
                    else options[key] = value;
                }
            });
            line = line.replace(/\{[^}]+\}\]\]$/, ']]');
        }
        return { line, options };
    }

    async processEmbed(embedLine, container, ctx, addGap) {
        try {
            const { line: cleanedLine, options } = this.parseEmbedOptions(embedLine);
            const match = cleanedLine.match(/!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
            if (!match) return;

            let linkText = match[1];
            let displayAlias = match[2]?.trim();
            const hasDynamicPattern = /\{\{(date|time|title)/.test(linkText);

            if (hasDynamicPattern) {
                const cacheKey = `${linkText}-${ctx.sourcePath}`;
                const cached = this.dynamicPaths.pathCache.get(cacheKey);
                const now = Date.now();
                let resolvedText;
                
                if (cached && (now - cached.timestamp < 1000)) {
                    resolvedText = cached.value;
                } else {
                    resolvedText = this.dynamicPaths.resolve(linkText, ctx);
                    this.dynamicPaths.pathCache.set(cacheKey, { value: resolvedText, timestamp: now });
                }

                if (!displayAlias) displayAlias = linkText;
                linkText = resolvedText;
            }

            const linkPath = linkText.split('|')[0].trim();
            let notePath = linkPath.split('#')[0];
            const section = linkPath.includes('#') ? linkPath.substring(linkPath.indexOf('#') + 1) : null;

            if (!notePath) notePath = ctx.sourcePath;

            const file = this.plugin.app.metadataCache.getFirstLinkpathDest(notePath, ctx.sourcePath);
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
            embedContainer.addClass('sync-embed-loading');

            if (Object.keys(options).length > 0) {
                embedContainer.dataset.customOptions = JSON.stringify(options);
            }

            const placeholderText = displayAlias || `${file.basename}${section ? '#' + section : ''}`;
            const placeholder = embedContainer.createDiv('sync-embed-placeholder');
            placeholder.setText(`Loading ${placeholderText}...`);

            const renderAsCallout = options.callout !== undefined ? options.callout : this.plugin.settings.renderAsCallout;
            if (renderAsCallout) embedContainer.addClass('is-callout-style');

            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        observer.disconnect();
                        requestAnimationFrame(() => {
                            this.loadEmbed(embedContainer, file, section, displayAlias, ctx, placeholder, options);
                        });
                    }
                });
            }, {
                rootMargin: this.plugin.settings.lazyLoadThreshold,
                threshold: 0.01 
            });

            observer.observe(embedContainer);

        } catch (error) {
            console.error('Sync Embeds: Error processing embed:', error);
            this.renderError(container, `Error loading: ${error.message}`, addGap);
        }
    }

    async loadEmbed(embedContainer, file, section, alias, ctx, placeholder, customOptions = {}) {
        try {
            const component = new Component();
            const leaf = new WorkspaceLeaf(this.plugin.app);
            component.load();

            const embedData = {
                containerEl: embedContainer,
                file,
                section,
                alias,
                component,
                leaf,
                customOptions,
                sourcePath: ctx.sourcePath
            };

            component.addChild(new (class extends Component {
                constructor(manager, data) {
                    super();
                    this.manager = manager;
                    this.embedData = data;
                }
                async onunload() {
                    this.manager.activeEmbeds.delete(this.embedData);
                    if (this.manager.plugin.currentFocusedEmbed?.containerEl === this.embedData.containerEl) {
                        this.manager.plugin.currentFocusedEmbed = null;
                    }
                    if (this.embedData.leaf) this.embedData.leaf.detach();
                }
            })(this, embedData));

            await leaf.openFile(file, { state: { mode: 'source' } });
            const view = leaf.view;

            if (!(view instanceof MarkdownView)) {
                this.renderError(embedContainer.parentElement, 'Failed to load a markdown view.', false);
                leaf.detach();
                return;
            }

            embedData.view = view;
            embedData.editor = view.editor;

            this.embedRegistry.set(embedContainer, embedData);
            this.activeEmbeds.add(embedData);

            if (customOptions.height) embedContainer.style.setProperty('--sync-embed-height', customOptions.height);
            if (customOptions.maxHeight) embedContainer.style.setProperty('--sync-max-height', customOptions.maxHeight);
            if (customOptions.collapse === true) embedContainer.addClass('is-collapsed');

            const renderAsCallout = customOptions.callout !== undefined ? customOptions.callout : this.plugin.settings.renderAsCallout;
            const headerTitle = alias || (section ? `${file.basename} > ${section}` : file.basename);

            if (section) {
                const content = view.editor.getValue();
                const sectionInfo = this.viewportController.findSectionBounds(content, section);

                if (sectionInfo.startLine === -1) {
                    embedContainer.empty();
                    embedContainer.removeClass('sync-embed-loading');
                    embedContainer.style.height = 'auto';
                    embedContainer.style.minHeight = '0';
                    this.renderError(embedContainer, `Section not found: ${section}`, false);
                    leaf.detach();
                    return;
                }

                await this.viewportController.setupSectionViewport(embedData);
            }

            // UNIFIED HEADER/TITLE LOGIC
            const userWantsTitle = customOptions.title !== undefined ? customOptions.title : this.plugin.settings.showInlineTitle;
            
            // Callouts ALWAYS generate a header (for folding). Normal embeds respect settings.
            if (renderAsCallout || userWantsTitle) {
                this.setupHeaderUI(embedData, headerTitle, renderAsCallout, !!section);
            }

            // PROPERTIES LOGIC
            if (section) {
                this.hideProperties(embedData); // Sections shouldn't have properties
            } else if (this.plugin.settings.collapsePropertiesByDefault) {
                this.setupPropertiesCollapse(embedData); // Whole notes conditionally collapse natively
            }

            placeholder.replaceWith(view.containerEl);
            embedContainer.removeClass('sync-embed-loading');
            ctx.addChild(component);

        } catch (error) {
            console.error('Sync Embeds: Error loading embed:', error);
            placeholder.setText(`Error: ${error.message}`);
            placeholder.addClass('sync-embed-error');
        }
    }

    setupHeaderUI(embedData, displayTitle, renderAsCallout, isSection) {
        const { view, file, section, containerEl } = embedData;

        requestAnimationFrame(() => {
            setTimeout(() => {
                // Completely kill the native title to prevent duplication
                const titleEl = view.containerEl.querySelector('.inline-title');
                if (titleEl) titleEl.style.display = 'none';

                const viewContent = view.containerEl.querySelector('.view-content');
                if (!viewContent) return;
                if (view.containerEl.querySelector('.sync-embed-header')) return; // Prevent dupes

                const headerUI = document.createElement('div');
                headerUI.className = 'sync-embed-header';

                if (renderAsCallout) {
                    headerUI.classList.add('is-sticky');
                    
                    const foldBtn = headerUI.createDiv('sync-embed-fold');
                    setIcon(foldBtn, 'chevron-down');
                    
                    const linkPath = section ? `${file.path}#${section}` : file.path;
                    headerUI.createEl('a', {
                        cls: 'internal-link',
                        text: displayTitle,
                        attr: { 'href': linkPath, 'data-href': linkPath }
                    });

                    headerUI.addEventListener('click', (e) => {
                        if (e.target.closest('a')) return;
                        e.stopPropagation();
                        e.preventDefault();
                        containerEl.classList.toggle('is-collapsed');
                    });
                    
                    // Callout headers sit ABOVE the content to stick perfectly
                    view.containerEl.insertBefore(headerUI, viewContent);
                } else {
                    // Standard inline alias header sits inside the content
                    headerUI.textContent = displayTitle;
                    viewContent.insertBefore(headerUI, viewContent.firstChild);
                }
            }, 100);
        });
    }

    hideProperties(embedData) {
        const { view } = embedData;
        requestAnimationFrame(() => {
            setTimeout(() => {
                const propertiesEl = view.containerEl.querySelector('.metadata-container');
                if (propertiesEl) {
                    propertiesEl.style.display = 'none';
                }
            }, 50);
        });
    }

    setupPropertiesCollapse(embedData) {
        const { view } = embedData;
        requestAnimationFrame(() => {
            setTimeout(() => {
                const propertiesEl = view.containerEl.querySelector('.metadata-container');
                if (!propertiesEl) return;

                // Fire a real click event on the heading so Obsidian natively updates its internal state
                const heading = propertiesEl.querySelector('.metadata-properties-heading');
                if (heading && !propertiesEl.classList.contains('is-collapsed')) {
                    heading.click(); 
                }
            }, 100);
        });
    }

    renderError(container, message, addGap) {
        const errorDiv = container.createDiv('sync-embed-error');
        if (addGap) errorDiv.addClass('sync-embed-gap');
        errorDiv.setText(message);
    }
}

module.exports = EmbedManager;