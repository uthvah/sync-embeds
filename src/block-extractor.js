class BlockExtractor {
    constructor(plugin) {
        this.plugin = plugin;
    }

    async extract(files, extractType, filterText = '') {
        const results = [];
        const normalizedFilter = filterText.toLowerCase();

        for (const file of files) {
            const content = await this.plugin.app.vault.cachedRead(file);
            const blocks = this.extractBlocksByType(content, extractType);

            for (const block of blocks) {
                if (normalizedFilter && !block.originalText.toLowerCase().includes(normalizedFilter)) continue;
                results.push({
                    file,
                    originalText: block.originalText,
                    blockId: block.blockId
                });
            }
        }

        return results;
    }

    extractBlocksByType(content, extractType) {
        if (extractType === 'task') return this.extractWithRegex(content, /^\s*-\s*\[[ xX-]\].*$/gm);
        if (extractType === 'callout') return this.extractCallouts(content);
        if (extractType === 'list') return this.extractWithRegex(content, /^\s*[-*+]\s+.*$/gm);

        const merged = [];
        merged.push(...this.extractWithRegex(content, /^\s*-\s*\[[ xX-]\].*$/gm));
        merged.push(...this.extractCallouts(content));
        merged.push(...this.extractWithRegex(content, /^\s*[-*+]\s+.*$/gm));
        return this.dedupeBlocks(merged);
    }

    extractWithRegex(content, regex) {
        const blocks = [];
        const matches = content.matchAll(regex);

        for (const match of matches) {
            const text = match[0];
            blocks.push({
                originalText: text,
                blockId: this.extractBlockId(text)
            });
        }

        return blocks;
    }

    extractCallouts(content) {
        const blocks = [];
        const lines = content.split('\n');

        let i = 0;
        while (i < lines.length) {
            if (/^>\s*\[!.*?\]/.test(lines[i])) {
                const calloutLines = [lines[i]];
                i += 1;
                while (i < lines.length && lines[i].startsWith('>')) {
                    calloutLines.push(lines[i]);
                    i += 1;
                }
                const text = calloutLines.join('\n');
                blocks.push({ originalText: text, blockId: this.extractBlockId(text) });
            } else {
                i += 1;
            }
        }

        return blocks;
    }

    extractBlockId(text) {
        const match = text.match(/\^(?<id>[A-Za-z0-9_-]+)\s*$/m);
        return match?.groups?.id;
    }

    dedupeBlocks(blocks) {
        const seen = new Set();
        return blocks.filter(block => {
            const key = `${block.originalText}::${block.blockId || ''}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }
}

module.exports = BlockExtractor;
