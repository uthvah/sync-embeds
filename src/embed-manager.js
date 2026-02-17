const { Component, WorkspaceLeaf, MarkdownView } = require('obsidian');
const ViewportController = require('./viewport-controller');
const DynamicPaths = require('./dynamic-paths');

class EmbedManager {
    constructor(plugin) {
        this.plugin = plugin;
        // Use WeakMap to prevent memory leaks
        this.embedRegistry = new WeakMap();
        // Keep a Set for tracking active embeds for cleanup
        this.activeEmbeds = new Set();
        this.viewportController = new ViewportController(plugin);
        this.dynamicPaths = new DynamicPaths(plugin);
    }

    cleanup() {
        // Clean up all active embeds
        this.activeEmbeds.forEach(embedData => {
            if (embedData.component) {
                embedData.component.unload();
            }
            // Properly detach leaf and view
            if (embedData.leaf) {
                embedData.leaf.detach();
            }
        });
        this.activeEmbeds.clear();

        // Clean up dynamic paths cache
        if (this.dynamicPaths) {
            this.dynamicPaths.cleanup();
        }
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

        // Apply CSS custom properties
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

        // Calculate total height for lazy loading to prevent scrollbar jumps
        const estimatedHeight = embedLines.length * 200; // Rough estimate
        syncContainer.style.minHeight = `${estimatedHeight}px`;

        for (let i = 0; i < embedLines.length; i++) {
            await this.processEmbed(embedLines[i], syncContainer, ctx, i > 0);
        }

        // Remove min-height after all loaded
        setTimeout(() => {
            syncContainer.style.minHeight = '';
        }, 100);
    }

    parseEmbedOptions(line) {
        // Parse options like: ![[note|alias{height:500px,title:false}]]
        const optionsMatch = line.match(/\{([^}]+)\}\]\]$/);
        const options = {};

        if (optionsMatch) {
            const optionsStr = optionsMatch[1];
            const pairs = optionsStr.split(',');

            pairs.forEach(pair => {
                const [key, value] = pair.split(':').map(s => s.trim());
                if (key && value !== undefined) {
                    // Parse boolean values
                    if (value === 'true') options[key] = true;
                    else if (value === 'false') options[key] = false;
                    else options[key] = value;
                }
            });

            // Remove options from line for further parsing
            line = line.replace(/\{[^}]+\}\]\]$/, ']]');
        }

        return { line, options };
    }

    async processEmbed(embedLine, container, ctx, addGap) {
        try {
            // Parse custom options first
            const { line: cleanedLine, options } = this.parseEmbedOptions(embedLine);

            // Parse embed syntax: ![[path#section|alias]]
            const match = cleanedLine.match(/!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
            if (!match) return;

            let linkText = match[1];
            let displayAlias = match[2]?.trim();

            // Check if this has dynamic patterns
            const hasDynamicPattern = /\{\{(date|time|title)/.test(linkText);

            if (hasDynamicPattern) {
                // Check cache first (with 1 second TTL for date patterns)
                const cacheKey = `${linkText}-${ctx.sourcePath}`;
                const cached = this.dynamicPaths.pathCache.get(cacheKey);
                const now = Date.now();

                let resolvedText;
                if (cached && (now - cached.timestamp < 1000)) {
                    resolvedText = cached.value;
                    if (this.plugin.settings.debugMode) {
                        console.log('[Sync Embeds] Using cached resolution:', linkText, 'â†’', resolvedText);
                    }
                } else {
                    // Resolve dynamic patterns
                    resolvedText = this.dynamicPaths.resolve(linkText, ctx);
                    this.dynamicPaths.pathCache.set(cacheKey, { value: resolvedText, timestamp: now });

                    if (this.plugin.settings.debugMode) {
                        console.log('[Sync Embeds] Fresh resolution:', linkText, 'â†’', resolvedText);
                    }
                }

                // If no alias provided, use the original pattern as display name
                if (!displayAlias) {
                    displayAlias = linkText;
                }

                // CRITICAL: Use resolved text as the actual file path
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

            // Only check for direct recursion
            if (file.path === ctx.sourcePath) {
                this.renderError(container, "Cannot create a recursive embed of the same note.", addGap);
                return;
            }

            // Create embed container
            const embedContainer = container.createDiv('sync-embed');
            if (addGap) embedContainer.addClass('sync-embed-gap');
            embedContainer.addClass('sync-embed-loading');

            // Store custom options on container
            if (Object.keys(options).length > 0) {
                embedContainer.dataset.customOptions = JSON.stringify(options);
            }

            // Create placeholder for lazy loading
            const placeholderText = displayAlias || `${file.basename}${section ? '#' + section : ''}`;
            const placeholder = embedContainer.createDiv('sync-embed-placeholder');
            placeholder.setText(`Loading ${placeholderText}...`);

            // Aggressive lazy loading to prevent scrollbar jumps
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        observer.disconnect();
                        // Small delay to ensure smooth scrolling
                        requestAnimationFrame(() => {
                            this.loadEmbed(embedContainer, file, section, displayAlias, ctx, placeholder, options);
                        });
                    }
                });
            }, {
                rootMargin: this.plugin.settings.lazyLoadThreshold,
                threshold: 0.01 // Start loading as soon as 1% is visible
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

            // Store leaf for proper cleanup
            const embedData = {
                containerEl: embedContainer,
                file,
                section,
                alias,
                component,
                leaf,
                customOptions
            };

            // Register cleanup
            component.addChild(new (class extends Component {
                constructor(manager, data) {
                    super();
                    this.manager = manager;
                    this.embedData = data;
                }
                async onunload() {
                    // Remove from active embeds
                    this.manager.activeEmbeds.delete(this.embedData);

                    // Clear focus if this was focused
                    if (this.manager.plugin.currentFocusedEmbed?.containerEl === this.embedData.containerEl) {
                        this.manager.plugin.currentFocusedEmbed = null;
                    }

                    // Properly detach the leaf and clean up the view
                    if (this.embedData.leaf) {
                        this.embedData.leaf.detach();
                    }
                }
            })(this, embedData));

            // Open the full file in source mode
            await leaf.openFile(file, {
                state: { mode: 'source' }
            });

            const view = leaf.view;

            if (!(view instanceof MarkdownView)) {
                this.renderError(embedContainer.parentElement, 'Failed to load a markdown view.', false);
                leaf.detach();
                return;
            }

            // Update embedData with view and editor
            embedData.view = view;
            embedData.editor = view.editor;

            this.embedRegistry.set(embedContainer, embedData);
            this.activeEmbeds.add(embedData);

            // Apply custom height if specified
            if (customOptions.height) {
                embedContainer.style.setProperty('--sync-embed-height', customOptions.height);
            }

            if (customOptions.maxHeight) {
                embedContainer.style.setProperty('--sync-max-height', customOptions.maxHeight);
            }

            // For section embeds, validate section exists then set up
            if (section) {
                const content = view.editor.getValue();
                const sectionInfo = this.viewportController.findSectionBounds(content, section);

                if (sectionInfo.startLine === -1) {
                    // Cleanup
                    embedContainer.empty();
                    embedContainer.removeClass('sync-embed-loading');
                    embedContainer.style.height = 'auto';
                    embedContainer.style.minHeight = '0';

                    // Render the error
                    this.renderError(embedContainer, `Section not found: ${section}`, false);
                    
                    leaf.detach();
                    return;
                }

                await this.viewportController.setupSectionViewport(embedData);

                // If there's an alias, show it instead of the actual header
                if (alias) {
                    this.setupAliasDisplay(embedData, alias, true);
                }
            } else if (alias) {
                // For whole note embeds with alias, show alias as title
                this.setupAliasDisplay(embedData, alias, false);
            }

            // Handle properties collapse
            if (this.plugin.settings.collapsePropertiesByDefault) {
                this.setupPropertiesCollapse(embedData);
            }

            // Handle inline title visibility
            const showTitle = customOptions.title !== undefined
                ? customOptions.title
                : this.plugin.settings.showInlineTitle;

            if (!showTitle || section) {
                this.hideInlineTitle(embedData);
            }

            // Remove placeholder and show actual content
            placeholder.remove();
            embedContainer.appendChild(view.containerEl);
            embedContainer.removeClass('sync-embed-loading');

            ctx.addChild(component);

        } catch (error) {
            console.error('Sync Embeds: Error loading embed:', error);
            placeholder.setText(`Error: ${error.message}`);
            placeholder.addClass('sync-embed-error');
        }
    }

    setupAliasDisplay(embedData, displayAlias, isSection) {
        const { view } = embedData;

        requestAnimationFrame(() => {
            setTimeout(() => {
                // Hide the inline title
                const titleEl = view.containerEl.querySelector('.inline-title');
                if (titleEl) {
                    titleEl.style.display = 'none';
                }

                // For section embeds, also hide the section header
                if (isSection) {
                    const cmContent = view.containerEl.querySelector('.cm-content');
                    if (cmContent) {
                        if (embedData.sectionInfo) {
                            const headerLineNumber = embedData.sectionInfo.startLine + 1;
                            const firstLine = cmContent.querySelector(`.cm-line:nth-child(${headerLineNumber})`);
                            if (firstLine) {
                                firstLine.style.display = 'none';
                            }
                        }
                    }
                }

                // Create and insert alias header with consistent styling
                const aliasHeader = view.containerEl.createDiv('sync-embed-alias-header');
                aliasHeader.textContent = displayAlias;

                const viewContent = view.containerEl.querySelector('.view-content');
                if (viewContent) {
                    viewContent.insertBefore(aliasHeader, viewContent.firstChild);
                }
            }, 100);
        });
    }

    setupPropertiesCollapse(embedData) {
        const { view } = embedData;

        requestAnimationFrame(() => {
            setTimeout(() => {
                const propertiesEl = view.containerEl.querySelector('.metadata-container');
                if (!propertiesEl) return;

                propertiesEl.classList.add('is-collapsed');

                const toggleBtn = propertiesEl.createDiv('properties-collapse-toggle');
                toggleBtn.innerHTML = 'â–¶';
                toggleBtn.onclick = () => {
                    propertiesEl.classList.toggle('is-collapsed');
                    toggleBtn.innerHTML = propertiesEl.classList.contains('is-collapsed') ? 'â–¶' : 'â–¼';
                };
            }, 100);
        });
    }

    hideInlineTitle(embedData) {
        const { view } = embedData;
        requestAnimationFrame(() => {
            setTimeout(() => {
                const titleEl = view.containerEl.querySelector('.inline-title');
                if (titleEl) {
                    titleEl.style.display = 'none';
                }
            }, 50);
        });
    }

    renderError(container, message, addGap) {
        const errorDiv = container.createDiv('sync-embed-error');
        if (addGap) errorDiv.addClass('sync-embed-gap');
        errorDiv.setText(message);
    }
}

module.exports = EmbedManager;
