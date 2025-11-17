const { moment } = require('obsidian');

class DynamicPaths {
    constructor(plugin) {
        this.plugin = plugin;
        this.pathCache = new Map();
        
        // Auto-cleanup cache every minute
        this.cacheCleanupInterval = setInterval(() => {
            this.cleanupCache();
        }, 60000); // 1 minute
    }

    cleanup() {
        if (this.cacheCleanupInterval) {
            clearInterval(this.cacheCleanupInterval);
        }
        this.pathCache.clear();
    }

    cleanupCache() {
        const now = Date.now();
        const maxAge = 60000; // 1 minute
        
        for (const [key, cached] of this.pathCache.entries()) {
            if (now - cached.timestamp > maxAge) {
                this.pathCache.delete(key);
            }
        }
        
        if (this.plugin.settings.debugMode) {
            console.log('[Sync Embeds] Cache cleanup: removed stale entries, size now:', this.pathCache.size);
        }
    }

    resolve(linkPath, ctx) {
        let resolved = linkPath;

        try {
            // Process in order: date offsets, then simple dates, then time, then title
            
            // Replace date offset patterns FIRST: {{date-7d:YYYY-MM-DD}}
            resolved = this.resolveDateOffsetPatterns(resolved);
            
            // Replace simple date patterns: {{date:YYYY-MM-DD}}
            resolved = this.resolveDatePatterns(resolved);

            // Replace time patterns: {{time:HH:mm}}
            resolved = this.resolveTimePatterns(resolved);

            // Replace title pattern: {{title}}
            resolved = this.resolveTitlePattern(resolved, ctx);
            
            // Log for debugging
            if (this.plugin.settings.debugMode && resolved !== linkPath) {
                console.log('[Sync Embeds] Dynamic path resolved:', linkPath, 'â†’', resolved);
            }
        } catch (error) {
            console.error('Sync Embeds: Error resolving dynamic path:', error);
            // Return original path on error
            return linkPath;
        }

        return resolved;
    }

    resolveDateOffsetPatterns(linkPath) {
        // Pattern: {{date[+-]NUMBER[dwmy]:FORMAT}}
        // Examples: {{date-7d:YYYY-MM-DD}}, {{date+1w:YYYY-MM-DD}}
        const offsetPattern = /\{\{date([+-]\d+)([dwmy]):([^}]+)\}\}/g;
        
        return linkPath.replace(offsetPattern, (match, offset, unit, format) => {
            try {
                const amount = parseInt(offset, 10);
                const unitMap = {
                    'd': 'days',
                    'w': 'weeks',
                    'm': 'months',
                    'y': 'years'
                };
                
                if (!unitMap[unit]) {
                    console.error('Sync Embeds: Invalid date offset unit:', unit);
                    return match;
                }
                
                // Validate format
                if (!this.isValidMomentFormat(format)) {
                    console.warn('Sync Embeds: Potentially invalid date format:', format);
                }
                
                const result = moment().add(amount, unitMap[unit]).format(format);
                
                if (this.plugin.settings.debugMode) {
                    console.log('[Sync Embeds] Date offset resolved:', match, 'â†’', result);
                }
                
                return result;
            } catch (error) {
                console.error('Sync Embeds: Error in date offset pattern:', error);
                return match;
            }
        });
    }

    resolveDatePatterns(linkPath) {
        // Pattern: {{date:FORMAT}}
        // Example: {{date:YYYY-MM-DD}}
        const datePattern = /\{\{date:([^}]+)\}\}/g;
        
        return linkPath.replace(datePattern, (match, format) => {
            try {
                // Validate format
                if (!this.isValidMomentFormat(format)) {
                    console.warn('Sync Embeds: Potentially invalid date format:', format);
                }
                
                const result = moment().format(format);
                
                if (this.plugin.settings.debugMode) {
                    console.log('[Sync Embeds] Date resolved:', match, 'â†’', result);
                }
                
                return result;
            } catch (error) {
                console.error('Sync Embeds: Invalid date format:', format, error);
                return match; // Return original if format is invalid
            }
        });
    }

    resolveTimePatterns(linkPath) {
        // Pattern: {{time:FORMAT}}
        // Example: {{time:HH:mm}}
        const timePattern = /\{\{time:([^}]+)\}\}/g;
        
        return linkPath.replace(timePattern, (match, format) => {
            try {
                // Validate format
                if (!this.isValidMomentFormat(format)) {
                    console.warn('Sync Embeds: Potentially invalid time format:', format);
                }
                
                const result = moment().format(format);
                
                if (this.plugin.settings.debugMode) {
                    console.log('[Sync Embeds] Time resolved:', match, 'â†’', result);
                }
                
                return result;
            } catch (error) {
                console.error('Sync Embeds: Invalid time format:', format, error);
                return match;
            }
        });
    }

    resolveTitlePattern(linkPath, ctx) {
        // Pattern: {{title}}
        const titlePattern = /\{\{title\}\}/g;
        
        if (!ctx.sourcePath) {
            return linkPath.replace(titlePattern, '');
        }

        try {
            const currentFile = this.plugin.app.vault.getAbstractFileByPath(ctx.sourcePath);
            const title = currentFile?.basename || '';
            
            if (this.plugin.settings.debugMode && linkPath.includes('{{title}}')) {
                console.log('[Sync Embeds] Title resolved:', '{{title}}', 'â†’', title);
            }
            
            return linkPath.replace(titlePattern, title);
        } catch (error) {
            console.error('Sync Embeds: Error resolving title pattern:', error);
            return linkPath.replace(titlePattern, '');
        }
    }

    isValidMomentFormat(format) {
        // Basic validation for common moment.js format tokens
        // This is not exhaustive but catches obvious errors
        if (!format || format.trim() === '') return false;
        
        // Check for common valid tokens
        const validTokens = /[YMDdHhmsSaAZzX]/;
        return validTokens.test(format);
    }
}

module.exports = DynamicPaths;