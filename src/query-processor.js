const { Notice } = require('obsidian');

class QueryProcessor {
    constructor(plugin) {
        this.plugin = plugin;
    }

    parseYaml(source) {
        const config = {};
        const lines = source.split('\n');

        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line || line.startsWith('#')) continue;
            const sepIndex = line.indexOf(':');
            if (sepIndex === -1) continue;

            const key = line.slice(0, sepIndex).trim();
            let value = line.slice(sepIndex + 1).trim();

            const commentIndex = value.indexOf(' #');
            if (commentIndex !== -1) value = value.slice(0, commentIndex).trim();

            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }

            config[key] = value;
        }

        return {
            engine: (config.engine || 'native').toLowerCase(),
            query: config.query || '',
            extract: (config.extract || 'any').toLowerCase(),
            filter: config.filter || ''
        };
    }

    async execute(source, ctx) {
        const config = this.parseYaml(source);
        if (!config.query) {
            throw new Error('sync-query requires a query field');
        }

        let files = [];
        if (config.engine === 'native') {
            files = this.runNativeQuery(config.query);
        } else if (config.engine === 'dataview') {
            files = await this.runDataviewQuery(config.query, ctx);
        } else if (config.engine === 'regex') {
            files = await this.runRegexQuery(config.query);
        } else {
            throw new Error(`Unsupported engine: ${config.engine}`);
        }

        return { config, files };
    }

    runNativeQuery(query) {
        const tokens = query.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
        const tags = [];
        const paths = [];
        const textTerms = [];

        tokens.forEach(token => {
            const cleanToken = token.replace(/^"|"$/g, '');
            if (cleanToken.startsWith('tag:')) {
                tags.push(cleanToken.slice(4));
            } else if (cleanToken.startsWith('path:')) {
                paths.push(cleanToken.slice(5));
            } else {
                textTerms.push(cleanToken.toLowerCase());
            }
        });

        const files = this.plugin.app.vault.getMarkdownFiles();
        return files.filter(file => {
            const matchesPath = paths.length === 0 || paths.some(pathTerm => file.path.toLowerCase().includes(pathTerm.toLowerCase()));
            if (!matchesPath) return false;

            const cache = this.plugin.app.metadataCache.getFileCache(file);
            const cacheTags = (cache?.tags || []).map(tag => tag.tag);
            const matchesTags = tags.length === 0 || tags.every(tag => cacheTags.includes(tag));
            if (!matchesTags) return false;

            const textBlob = `${file.path} ${file.basename}`.toLowerCase();
            return textTerms.every(term => textBlob.includes(term));
        });
    }

    async runDataviewQuery(query, ctx) {
        const dataviewPlugin = this.plugin.app.plugins.plugins.dataview;
        if (!dataviewPlugin || typeof dataviewPlugin.api?.pages !== 'function') {
            new Notice('Dataview engine requested, but Dataview plugin is not installed.');
            return [];
        }

        const pages = dataviewPlugin.api.pages(query, ctx?.sourcePath);
        const files = [];

        if (!pages) return files;

        pages.forEach(page => {
            const path = page?.file?.path;
            if (!path) return;
            const file = this.plugin.app.vault.getAbstractFileByPath(path);
            if (file) files.push(file);
        });

        return files;
    }

    async runRegexQuery(query) {
        let regex;
        const literalMatch = query.match(/^\/(.*)\/([gimsuy]*)$/);

        if (literalMatch) {
            regex = new RegExp(literalMatch[1], literalMatch[2] || 'm');
        } else {
            regex = new RegExp(query, 'm');
        }

        const files = this.plugin.app.vault.getMarkdownFiles();
        const matches = [];

        for (const file of files) {
            const content = await this.plugin.app.vault.cachedRead(file);
            if (regex.test(content)) {
                matches.push(file);
            }
        }

        return matches;
    }
}

module.exports = QueryProcessor;
