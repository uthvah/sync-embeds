const { Plugin, MarkdownView } = require('obsidian');
const { around } = require('monkey-around');
const EmbedManager = require('./embed-manager');
const CommandInterceptor = require('./command-interceptor');
const SyncEmbedsSettingTab = require('./settings');

const DEFAULT_SETTINGS = {
    embedHeight: 'auto',
    maxEmbedHeight: 'none',
    collapsePropertiesByDefault: true,
    showInlineTitle: true,
    renderAsCallout: false,
    enableCommandInterception: true,
    gapBetweenEmbeds: '16px',
    lazyLoadThreshold: '100px',
    showFocusHighlight: true,
    showHeaderHints: true,           // NEW: Header hints (enforcement is always on)
    debugMode: false
};

module.exports = class SyncEmbedPlugin extends Plugin {
    constructor(app, manifest) {
        super(app, manifest);
        this.settings = DEFAULT_SETTINGS;
        this.DEFAULT_SETTINGS = DEFAULT_SETTINGS; // Expose for settings tab
        this.embedManager = null;
        this.commandInterceptor = null;
        this.currentFocusedEmbed = null;
        this.uninstallers = [];
    }

    async onload() {
        await this.loadSettings();
        
        // Initialize managers
        this.embedManager = new EmbedManager(this);
        this.commandInterceptor = new CommandInterceptor(this);
        
        // Setup command interception with monkey-around
        if (this.settings.enableCommandInterception) {
            this.setupCommandInterception();
        }

        // Register command to insert sync blocks
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

        // Register command to insert sync block with multiple embeds
        this.addCommand({
            id: 'insert-multi-synced-embed',
            name: 'Insert sync block with multiple embeds',
            editorCallback: (editor, view) => {
                const textToInsert = `\`\`\`sync\n![[Note 1]]\n![[Note 2]]\n\`\`\``;
                editor.replaceSelection(textToInsert);
            }
        });

        // Register command to insert dynamic date embed
        this.addCommand({
            id: 'insert-dynamic-date-embed',
            name: 'Insert dynamic date embed (today)',
            editorCallback: (editor, view) => {
                const textToInsert = `\`\`\`sync\n![[Daily/{{date:YYYY-MM-DD}}|Today]]\n\`\`\``;
                editor.replaceSelection(textToInsert);
            }
        });

        // NEW: Register header commands
        this.registerHeaderCommands();

        // Register markdown code block processor
        this.registerMarkdownCodeBlockProcessor('sync', (source, el, ctx) => {
            this.embedManager.processSyncBlock(source, el, ctx);
        });

        // Global focus tracking
        this.registerDomEvent(document, 'focusin', this.trackFocus.bind(this));
        this.registerDomEvent(document, 'focusout', this.trackFocusLoss.bind(this));

        // Add settings tab
        this.addSettingTab(new SyncEmbedsSettingTab(this.app, this));
        
        // Apply focus highlight setting
        this.updateFocusHighlight();
        
        // Log successful load
        this.log('Sync Embeds plugin loaded successfully');
    }

    onunload() {
        this.log('Unloading Sync Embeds plugin');
        
        // Clean up command interception
        this.uninstallers.forEach(uninstall => uninstall());
        this.uninstallers = [];
        
        // Clean up managers
        if (this.embedManager) {
            this.embedManager.cleanup();
        }
        
        this.currentFocusedEmbed = null;
    }

    registerHeaderCommands() {
        const headerLevels = [
            { level: 2, name: 'Heading 2', key: '2' },
            { level: 3, name: 'Heading 3', key: '3' },
            { level: 4, name: 'Heading 4', key: '4' },
            { level: 5, name: 'Heading 5', key: '5' },
            { level: 6, name: 'Heading 6', key: '6' },
        ];
        
        headerLevels.forEach(({ level, name, key }) => {
            this.addCommand({
                id: `insert-header-${level}`,
                name: `Toggle ${name}`,
                editorCallback: (editor, view) => {
                    // Check if we're in a sync embed
                    const focusedEmbed = this.getFocusedEmbed();
                    
                    if (focusedEmbed) {
                        // Use our custom handler
                        const handler = this.commandInterceptor.insertHeaderCommand(level);
                        return handler(focusedEmbed);
                    }
                    
                    // Fall back to normal behavior for non-embed editing
                    this.commandInterceptor.insertHeader({ editor }, level);
                },
                hotkeys: [
                    {
                        modifiers: ['Alt'],
                        key: key
                    }
                ]
            });
        });
        
        this.log('Registered header commands with default hotkeys (Alt+2-6)');
    }

    setupCommandInterception() {
        try {
            // Patch executeCommand to intercept ALL commands for focused embeds
            const executeCommandUninstall = around(this.app.commands, {
                executeCommand: (old) => {
                    const plugin = this;
                    return function(command, ...args) {
                        const focusedEmbed = plugin.getFocusedEmbed();
                        
                        // If embed is focused, check if we should intercept
                        if (focusedEmbed) {
                            // Check for our header commands first
                            const headerMatch = command.id.match(/^sync-embeds:insert-header-(\d+)$/);
                            if (headerMatch) {
                                const level = parseInt(headerMatch[1]);
                                plugin.log(`Intercepting header command: ${command.id}`);
                                const handler = plugin.commandInterceptor.insertHeaderCommand(level);
                                return handler(focusedEmbed);
                            }
                            
                            // Check if we have a custom handler
                            if (plugin.commandInterceptor.hasHandler(command.id)) {
                                plugin.log(`Intercepting command: ${command.id}`);
                                return plugin.commandInterceptor.handle(command.id, focusedEmbed, ...args);
                            }
                            
                            // For commands we don't handle, let them execute on the embed's editor
                            // This ensures ALL hotkeys work, including custom user-defined ones
                            plugin.log(`Passing through command to embed: ${command.id}`);
                            
                            // Check if command has a callback that expects an editor
                            if (command.editorCallback && focusedEmbed.editor) {
                                try {
                                    return command.editorCallback(focusedEmbed.editor, focusedEmbed.view);
                                } catch (error) {
                                    plugin.log(`Error executing command ${command.id} on embed:`, error);
                                    // Fall through to normal execution
                                }
                            }
                        }
                        
                        return old.call(this, command, ...args);
                    };
                }
            });
            this.uninstallers.push(executeCommandUninstall);

            // Patch getActiveViewOfType to return embed view when focused
            const getActiveViewUninstall = around(this.app.workspace, {
                getActiveViewOfType: (old) => {
                    const plugin = this;
                    return function(type) {
                        const focusedEmbed = plugin.getFocusedEmbed();
                        if (focusedEmbed && focusedEmbed.view instanceof type) {
                            plugin.log(`Returning embed view for type: ${type.name}`);
                            return focusedEmbed.view;
                        }
                        return old.call(this, type);
                    };
                }
            });
            this.uninstallers.push(getActiveViewUninstall);
            
            // Patch getActiveViewOfType on workspace.activeLeaf as well
            const getActiveLeafUninstall = around(this.app.workspace, {
                activeLeaf: {
                    get: (old) => {
                        const plugin = this;
                        return function() {
                            const focusedEmbed = plugin.getFocusedEmbed();
                            if (focusedEmbed && focusedEmbed.leaf) {
                                plugin.log('Returning embed leaf as active leaf');
                                return focusedEmbed.leaf;
                            }
                            return old.call(this);
                        };
                    }
                }
            });
            this.uninstallers.push(getActiveLeafUninstall);
            
            this.log('Command interception setup complete');
        } catch (error) {
            console.error('Sync Embeds: Failed to setup command interception:', error);
        }
    }

    // Focus tracking
    trackFocus(event) {
        const embed = this.embedManager.getEmbedFromElement(event.target);
        if (embed) {
            this.currentFocusedEmbed = embed;
            this.log('Focus changed to embed:', embed.file?.basename);
        }
    }

    trackFocusLoss(event) {
        const embed = this.embedManager.getEmbedFromElement(event.relatedTarget);
        if (!embed) {
            this.log('Focus lost from embed');
            this.currentFocusedEmbed = null;
        }
    }

    getFocusedEmbed() {
        return this.currentFocusedEmbed;
    }

    // Settings management
    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
        this.refreshAllEmbeds();
        this.updateFocusHighlight();
    }

    updateFocusHighlight() {
        if (this.settings.showFocusHighlight) {
            document.body.removeClass('sync-embeds-no-focus-highlight');
        } else {
            document.body.addClass('sync-embeds-no-focus-highlight');
        }
    }

    refreshAllEmbeds() {
        // Update CSS variables for all sync containers
        document.querySelectorAll('.sync-container').forEach(container => {
            container.style.setProperty('--sync-embed-height', this.settings.embedHeight);
            container.style.setProperty('--sync-max-height', this.settings.maxEmbedHeight);
            container.style.setProperty('--sync-gap', this.settings.gapBetweenEmbeds);
        });
        
        this.log('Refreshed all embeds with new settings');
    }

    // Debug logging
    log(...args) {
        if (this.settings.debugMode) {
            console.log('[Sync Embeds]', ...args);
        }
    }
};