const { PluginSettingTab, Setting, Notice } = require('obsidian');

class SyncEmbedsSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Sync Embeds Settings' });

        // === APPEARANCE SECTION ===
        containerEl.createEl('h3', { text: 'Appearance' });

        // Height presets + custom
        new Setting(containerEl)
            .setName('Embed height')
            .setDesc('Default height for embeds')
            .addDropdown(dropdown => dropdown
                .addOption('auto', 'Auto (fit content)')
                .addOption('300px', 'Compact (300px)')
                .addOption('500px', 'Normal (500px)')
                .addOption('700px', 'Large (700px)')
                .addOption('custom', 'Custom')
                .setValue(this.getHeightPreset())
                .onChange(async (value) => {
                    if (value !== 'custom') {
                        this.plugin.settings.embedHeight = value;
                        await this.plugin.saveSettings();
                        this.display(); // Refresh to hide custom input
                    } else {
                        this.display(); // Show custom input
                    }
                }));

        // Show custom input if needed
        if (this.getHeightPreset() === 'custom') {
            new Setting(containerEl)
                .setName('Custom height')
                .setDesc('Enter a custom height (e.g., 450px, 60vh)')
                .addText(text => text
                    .setPlaceholder('e.g., 450px, 60vh')
                    .setValue(this.plugin.settings.embedHeight)
                    .onChange(async (value) => {
                        if (this.validateCSSValue(value)) {
                            this.plugin.settings.embedHeight = value;
                            await this.plugin.saveSettings();
                        }
                    }));
        }

        // Max height presets + custom
        new Setting(containerEl)
            .setName('Maximum height')
            .setDesc('Maximum height before scrolling')
            .addDropdown(dropdown => dropdown
                .addOption('none', 'None (no limit)')
                .addOption('400px', 'Compact (400px)')
                .addOption('600px', 'Normal (600px)')
                .addOption('80vh', 'Large (80vh)')
                .addOption('custom', 'Custom')
                .setValue(this.getMaxHeightPreset())
                .onChange(async (value) => {
                    if (value !== 'custom') {
                        this.plugin.settings.maxEmbedHeight = value;
                        await this.plugin.saveSettings();
                        this.display();
                    } else {
                        this.display();
                    }
                }));

        // Show custom input if needed
        if (this.getMaxHeightPreset() === 'custom') {
            new Setting(containerEl)
                .setName('Custom maximum height')
                .setDesc('Enter a custom maximum height (e.g., 550px, 70vh)')
                .addText(text => text
                    .setPlaceholder('e.g., 550px, 70vh')
                    .setValue(this.plugin.settings.maxEmbedHeight)
                    .onChange(async (value) => {
                        if (this.validateCSSValue(value)) {
                            this.plugin.settings.maxEmbedHeight = value;
                            await this.plugin.saveSettings();
                        }
                    }));
        }

        // Gap presets + custom
        new Setting(containerEl)
            .setName('Gap between embeds')
            .setDesc('Spacing between multiple embeds in a sync block')
            .addDropdown(dropdown => dropdown
                .addOption('8px', 'Compact (8px)')
                .addOption('16px', 'Normal (16px)')
                .addOption('24px', 'Spacious (24px)')
                .addOption('custom', 'Custom')
                .setValue(this.getGapPreset())
                .onChange(async (value) => {
                    if (value !== 'custom') {
                        this.plugin.settings.gapBetweenEmbeds = value;
                        await this.plugin.saveSettings();
                        this.display();
                    } else {
                        this.display();
                    }
                }));

        // Show custom input if needed
        if (this.getGapPreset() === 'custom') {
            new Setting(containerEl)
                .setName('Custom gap')
                .setDesc('Enter a custom gap (e.g., 20px, 1.5rem)')
                .addText(text => text
                    .setPlaceholder('e.g., 20px, 1.5rem')
                    .setValue(this.plugin.settings.gapBetweenEmbeds)
                    .onChange(async (value) => {
                        if (this.validateCSSValue(value)) {
                            this.plugin.settings.gapBetweenEmbeds = value;
                            await this.plugin.saveSettings();
                        }
                    }));
        }

        // === BEHAVIOR SECTION ===
        containerEl.createEl('h3', { text: 'Behavior' });

        new Setting(containerEl)
            .setName('Collapse properties by default')
            .setDesc('Hide frontmatter/properties in embeds by default')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.collapsePropertiesByDefault)
                .onChange(async (value) => {
                    this.plugin.settings.collapsePropertiesByDefault = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Show inline title')
            .setDesc('Display note title at the top of whole-note embeds (not applicable to section embeds or embeds with aliases)')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showInlineTitle)
                .onChange(async (value) => {
                    this.plugin.settings.showInlineTitle = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Show focus highlight')
            .setDesc('Highlight the focused embed with an outline')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showFocusHighlight)
                .onChange(async (value) => {
                    this.plugin.settings.showFocusHighlight = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Show backlinks in embeds')
            .setDesc('Display backlinks section at the bottom of embeds (not applicable if Obsidian\'s global setting for backlinks in documents is disabled)')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showBacklinksInEmbeds)
                .onChange(async (value) => {
                    this.plugin.settings.showBacklinksInEmbeds = value;
                    await this.plugin.saveSettings();
                }));

        // === HEADER MANAGEMENT SECTION ===
        containerEl.createEl('h3', { text: 'Header Management' });

        new Setting(containerEl)
            .setName('Show header hints')
            .setDesc('Display helpful notices when header creation is blocked in section embeds')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showHeaderHints)
                .onChange(async (value) => {
                    this.plugin.settings.showHeaderHints = value;
                    await this.plugin.saveSettings();
                }));

        // === PERFORMANCE SECTION ===
        containerEl.createEl('h3', { text: 'Performance' });

        new Setting(containerEl)
            .setName('Lazy loading threshold')
            .setDesc('Start loading embeds this distance before they become visible')
            .addDropdown(dropdown => dropdown
                .addOption('0px', 'On screen (0px)')
                .addOption('100px', 'Just before (100px)')
                .addOption('200px', 'Well before (200px)')
                .addOption('500px', 'Early (500px)')
                .setValue(this.plugin.settings.lazyLoadThreshold)
                .onChange(async (value) => {
                    this.plugin.settings.lazyLoadThreshold = value;
                    await this.plugin.saveSettings();
                }));

        // === ADVANCED SECTION ===
        containerEl.createEl('h3', { text: 'Advanced' });

        new Setting(containerEl)
            .setName('Enable command interception')
            .setDesc('Allow keyboard shortcuts (Ctrl+B, Ctrl+I, etc.) to work in embeds. Requires restart.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableCommandInterception)
                .onChange(async (value) => {
                    this.plugin.settings.enableCommandInterception = value;
                    await this.plugin.saveSettings();
                    new Notice('Please restart Obsidian for this change to take effect');
                }));

        // Debug mode
        new Setting(containerEl)
            .setName('Debug mode')
            .setDesc('Enable detailed console logging for troubleshooting')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.debugMode || false)
                .onChange(async (value) => {
                    this.plugin.settings.debugMode = value;
                    await this.plugin.saveSettings();
                }));

        // === HELP SECTION ===
        containerEl.createEl('h3', { text: 'Help & Documentation' });

        const helpDiv = containerEl.createDiv('sync-embeds-help');
        helpDiv.innerHTML = `
            <p><strong>Basic Usage:</strong></p>
            <ul>
                <li><code>![[Note Name]]</code> - Embed entire note</li>
                <li><code>![[Note Name#Section]]</code> - Embed specific section</li>
                <li><code>![[Note Name|Custom Title]]</code> - Display with custom title</li>
                <li><code>![[Note Name#Section|Custom Title]]</code> - Section with custom title</li>
            </ul>

            <p><strong>Per-Embed Custom Options:</strong></p>
            <ul>
                <li><code>![[Note|Alias{height:500px}]]</code> - Custom height for this embed</li>
                <li><code>![[Note|Alias{maxHeight:600px}]]</code> - Custom max height</li>
                <li><code>![[Note|Alias{title:false}]]</code> - Hide title for this embed</li>
                <li><code>![[Note|Alias{backlinks:false}]]</code> - Hide backlinks for this embed</li>
                <li><code>![[Note|Alias{height:400px,title:false}]]</code> - Multiple options</li>
            </ul>
            <p><em>Note: Options go inside curly braces before the closing ]]</em></p>

            <p><strong>Dynamic Patterns:</strong></p>
            <ul>
                <li><code>![[Daily/{{date:YYYY-MM-DD}}|Today]]</code> - Current date with display name</li>
                <li><code>![[Tasks#{{date:YYYY-MM-DD}}|Today's Tasks]]</code> - Dynamic section</li>
                <li><code>{{date-7d:YYYY-MM-DD}}</code> - 7 days ago</li>
                <li><code>{{date+1w:YYYY-MM-DD}}</code> - 1 week from now</li>
                <li><code>{{date+2m:YYYY-MM-DD}}</code> - 2 months from now</li>
                <li><code>{{time:HH:mm}}</code> - Current time</li>
                <li><code>{{title}}</code> - Current note's title</li>
            </ul>

            <p><strong>Header Management:</strong></p>
            <ul>
                <li>Use <code>Alt+2</code> through <code>Alt+6</code> to insert headers (H2-H6)</li>
                <li>In section embeds, only sub-headers are allowed (e.g., if section is H2, only H3-H6 work)</li>
                <li>Typing <code>#</code> at line start is blocked in section embeds to prevent hierarchy violations</li>
                <li>Press the same hotkey again on a header to remove formatting</li>
                <li>Press a different hotkey to change header level</li>
                <li>Whole-note embeds allow H1-H6 freely</li>
                <li>These hotkeys can be customized in Obsidian's Hotkeys settings</li>
            </ul>

            <p><strong>Date Format Examples:</strong></p>
            <ul>
                <li><code>YYYY-MM-DD</code> - 2024-03-15</li>
                <li><code>YYYY/MM/DD</code> - 2024/03/15</li>
                <li><code>DD MMM YYYY</code> - 15 Mar 2024</li>
                <li><code>dddd, MMMM Do YYYY</code> - Friday, March 15th 2024</li>
            </ul>

            <p><strong>Complete Example:</strong></p>
            <pre><code>\`\`\`sync
![[Daily Notes/{{date:YYYY-MM-DD}}|Today's Note]]
![[Daily Notes/{{date-1d:YYYY-MM-DD}}|Yesterday]]
![[Tasks#Inbox|My Tasks{height:300px}]]
![[Projects/{{title}}#Notes|Project Notes{title:false}]]
\`\`\`</code></pre>

            <p><strong>Tips:</strong></p>
            <ul>
                <li>Use aliases (text after <code>|</code>) with dynamic patterns for better display</li>
                <li>Per-embed options override global settings: <code>{height:400px,title:false}</code></li>
                <li>Section embeds are fully editable and changes sync immediately</li>
                <li>Press Tab/Shift+Tab to navigate between embeds</li>
                <li>Keyboard shortcuts work inside embeds when command interception is enabled</li>
                <li>Use lazy loading for better performance with many embeds</li>
                <li>Multiple embeds of the same note/section are allowed</li>
                <li>Header hierarchy enforcement maintains document structure in section embeds</li>
            </ul>

            <p><em>Note: Dynamic patterns are cached for 1 second to improve performance.</em></p>
        `;

        // Reset to defaults button
        containerEl.createEl('h3', { text: 'Reset' });
        new Setting(containerEl)
            .setName('Reset to defaults')
            .setDesc('Reset all settings to their default values')
            .addButton(button => button
                .setButtonText('Reset')
                .setWarning()
                .onClick(async () => {
                    if (confirm('Are you sure you want to reset all settings to defaults?')) {
                        Object.assign(this.plugin.settings, this.plugin.DEFAULT_SETTINGS);
                        await this.plugin.saveSettings();
                        this.display();
                        new Notice('Settings reset to defaults');
                    }
                }));
    }

    // Helper methods for presets
    getHeightPreset() {
        const value = this.plugin.settings.embedHeight;
        if (['auto', '300px', '500px', '700px'].includes(value)) {
            return value;
        }
        return 'custom';
    }

    getMaxHeightPreset() {
        const value = this.plugin.settings.maxEmbedHeight;
        if (['none', '400px', '600px', '80vh'].includes(value)) {
            return value;
        }
        return 'custom';
    }

    getGapPreset() {
        const value = this.plugin.settings.gapBetweenEmbeds;
        if (['8px', '16px', '24px'].includes(value)) {
            return value;
        }
        return 'custom';
    }

    validateCSSValue(value) {
        // Basic validation for CSS length values
        if (!value || value.trim() === '') return false;

        // Allow common CSS units
        const validPattern = /^(auto|none|\d+(\.\d+)?(px|em|rem|vh|vw|%))$/;
        const isValid = validPattern.test(value.trim());

        if (!isValid) {
            new Notice('Invalid CSS value. Use units like: px, em, rem, vh, vw, %, or "auto"/"none"');
        }

        return isValid;
    }
}

module.exports = SyncEmbedsSettingTab;
