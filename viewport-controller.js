const { Notice } = require('obsidian');

class ViewportController {
    constructor(plugin) {
        this.plugin = plugin;
    }

    async setupSectionViewport(embedData) {
        const { view, editor, file, section } = embedData;
        
        // Wait for editor to be ready
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const content = editor.getValue();
        const sectionInfo = this.findSectionBounds(content, section);
        
        if (sectionInfo.startLine === -1) {
            // Section not found
            editor.setValue(`# ${section}\n\n*Section not found in file.*`);
            return;
        }
        
        // Store section metadata
        embedData.sectionInfo = sectionInfo;
        embedData.viewportActive = true;
        
        // Apply the viewport restriction
        this.applyViewportRestriction(embedData);
        
        // Setup header protection (simplified, no auto-correction)
        this.setupHeaderProtection(embedData);
        
        // NEW: Setup input interception to block # typing
        this.setupHeaderInputInterception(embedData);
        
        // Setup cursor and content constraints
        this.setupContentConstraints(embedData);
        
        // Scroll to section
        this.scrollToSection(embedData);
    }

    applyViewportRestriction(embedData) {
        const { view, sectionInfo } = embedData;
        const { startLine, endLine } = sectionInfo;
        
        // Use CSS to hide lines outside the viewport
        const style = document.createElement('style');
        style.className = 'sync-viewport-style';
        
        // Generate unique ID for this embed
        const embedId = 'embed-' + Math.random().toString(36).substr(2, 9);
        view.containerEl.setAttribute('data-embed-id', embedId);
        
        // Store embed ID for dynamic updates
        embedData.embedId = embedId;
        
        this.updateViewportCSS(embedData, style);
        
        view.containerEl.appendChild(style);
        
        // Store for cleanup and updates
        embedData.viewportStyle = style;
    }

    updateViewportCSS(embedData, style) {
        const { sectionInfo, embedId } = embedData;
        const { startLine, endLine } = sectionInfo;
        
        // PERFORMANCE: Use efficient CSS selectors
        const css = `
            /* Hide all lines before the section */
            [data-embed-id="${embedId}"] .cm-line:nth-child(-n+${startLine}) { 
                display: none !important; 
            }
            
            /* Hide all lines after the section */
            [data-embed-id="${embedId}"] .cm-line:nth-child(n+${endLine + 1}) { 
                display: none !important; 
            }
            
            /* Style the header line - No background, proper theming */
            [data-embed-id="${embedId}"] .cm-line:nth-child(${startLine + 1}) {
                pointer-events: none !important;
                user-select: none !important;
                cursor: default !important;
            }
        `;
        
        style.textContent = css;
    }

    setupHeaderProtection(embedData) {
        const { view, editor, sectionInfo, component } = embedData;
        const { startLine } = sectionInfo;
        
        // Store original header to restore if modified
        const originalHeader = editor.getLine(startLine);
        embedData.originalHeader = originalHeader;
        
        let isProgrammaticUpdate = false;
        
        const changeHandler = (changedEditor) => {
            if (changedEditor !== editor || isProgrammaticUpdate) return;
            if (!embedData.viewportActive) return;
            
            const cursorPos = editor.getCursor();
            const absoluteLine = cursorPos.line;
            
            // Protect the header line from any edits
            if (absoluteLine === startLine) {
                const currentLine = editor.getLine(startLine);
                if (currentLine !== originalHeader) {
                    isProgrammaticUpdate = true;
                    editor.replaceRange(
                        originalHeader,
                        { line: startLine, ch: 0 },
                        { line: startLine, ch: currentLine.length }
                    );
                    // Move cursor to line below
                    editor.setCursor({ line: startLine + 1, ch: 0 });
                    isProgrammaticUpdate = false;
                }
            }
        };
        
        component.registerEvent(
            this.plugin.app.workspace.on('editor-change', changeHandler)
        );
    }

    setupHeaderInputInterception(embedData) {
        // CHANGED: Removed `sectionInfo` from destructuring to avoid a stale closure.
        const { view, editor, component } = embedData;
        // The header level of the main section won't change, so it's safe to get it once.
        const { headerLevel } = embedData.sectionInfo;
        
        // Always enforce in section embeds
        let lastNoticeTime = 0;
        const noticeDebounce = 5000; // 5 seconds between notices
        
        // CRITICAL: Wait for the editor to be fully ready and focused
        // Use a small delay to ensure the CodeMirror editor is properly initialized
        const setupHandlers = () => {
            // Get the actual CodeMirror editor element
            const cmEditor = view.containerEl.querySelector('.cm-content');
            if (!cmEditor) {
                // Retry if not ready yet
                setTimeout(setupHandlers, 50);
                return;
            }
            
            // Handle input event to catch # at line start (use 'input' not 'beforeinput' for better timing)
            const inputHandler = (event) => {
                // Only process insertText events
                if (event.inputType !== 'insertText' && event.inputType !== 'insertFromPaste') return;
                if (event.data !== '#') return;
                
                // Check immediately if # was typed at line start
                const cursor = editor.getCursor();
                const line = editor.getLine(cursor.line);
                
                // Check if the # is at the start of the line (accounting for whitespace)
                const beforeHash = line.substring(0, cursor.ch - 1);
                const isAtLineStart = /^\s*$/.test(beforeHash);
                
                // CHANGED: Read directly from `embedData.sectionInfo` to get the latest, non-stale bounds.
                if (isAtLineStart && 
                    cursor.line > embedData.sectionInfo.startLine && 
                    cursor.line < embedData.sectionInfo.endLine) {
                    
                    // Remove the # that was just typed
                    const currentLine = editor.getLine(cursor.line);
                    const newLine = currentLine.substring(0, cursor.ch - 1) + currentLine.substring(cursor.ch);
                    editor.replaceRange(
                        newLine,
                        { line: cursor.line, ch: 0 },
                        { line: cursor.line, ch: currentLine.length }
                    );
                    editor.setCursor({ line: cursor.line, ch: cursor.ch - 1 });
                    
                    // Show notice (debounced)
                    const now = Date.now();
                    if (this.plugin.settings.showHeaderHints && 
                        now - lastNoticeTime > noticeDebounce) {
                        
                        lastNoticeTime = now;
                        
                        const availableLevels = [];
                        for (let i = headerLevel + 1; i <= 6; i++) {
                            availableLevels.push(`H${i} (Alt+${i})`);
                        }
                        
                        new Notice(
                            `⚠️ Cannot create H1-H${headerLevel} headers in this section.\n` +
                            `Use: ${availableLevels.join(', ')}`,
                            5000
                        );
                    }
                }
            };
            
            // Also handle paste events
            const pasteHandler = (event) => {
                const clipboardData = event.clipboardData?.getData('text');
                if (!clipboardData) return;
                
                const cursor = editor.getCursor();
                
                // CHANGED: Read directly from `embedData.sectionInfo` to get the latest, non-stale bounds.
                if (cursor.line > embedData.sectionInfo.startLine && 
                    cursor.line < embedData.sectionInfo.endLine) {
                    
                    const lines = clipboardData.split('\n');
                    let hasInvalidHeaders = false;
                    
                    // Check if pasted content has invalid headers
                    const adjustedLines = lines.map(line => {
                        const match = line.match(/^(#{1,6})\s+(.*)$/);
                        if (!match) return line;
                        
                        const [, hashes, content] = match;
                        const level = hashes.length;
                        
                        if (level <= headerLevel) {
                            hasInvalidHeaders = true;
                            // Adjust to minimum allowed level
                            const newLevel = headerLevel + 1;
                            return '#'.repeat(newLevel) + ' ' + content;
                        }
                        return line;
                    });
                    
                    if (hasInvalidHeaders) {
                        event.preventDefault();
                        
                        if (this.plugin.settings.showHeaderHints) {
                            new Notice(
                                'Pasted headers adjusted to maintain section hierarchy',
                                4000
                            );
                        }
                        
                        // Insert adjusted content
                        editor.replaceSelection(adjustedLines.join('\n'));
                    }
                }
            };
            
            // Use 'input' event which fires AFTER the character is inserted
            cmEditor.addEventListener('input', inputHandler, true);
            cmEditor.addEventListener('paste', pasteHandler, true);
            
            // Cleanup
            component.register(() => {
                cmEditor.removeEventListener('input', inputHandler, true);
                cmEditor.removeEventListener('paste', pasteHandler, true);
            });
        };
        
        // Start setup with a small delay to ensure editor is ready
        setTimeout(setupHandlers, 100);
    }

    setupContentConstraints(embedData) {
        const { view, editor, sectionInfo, component } = embedData;
        
        let isProgrammaticUpdate = false;
        
        // CRITICAL FIX: Update viewport IMMEDIATELY before visible changes
        const updateViewportImmediately = () => {
            if (!embedData.viewportActive) return;
            
            const currentContent = editor.getValue();
            const newSectionInfo = this.findSectionBounds(currentContent, embedData.section);
            
            if (newSectionInfo.startLine !== -1) {
                embedData.sectionInfo = newSectionInfo;
                
                // Update CSS synchronously to prevent flashing
                if (embedData.viewportStyle) {
                    this.updateViewportCSS(embedData, embedData.viewportStyle);
                }
            }
        };
        
        // Monitor for content changes with instant updates
        const constrainContent = () => {
            if (isProgrammaticUpdate || !embedData.viewportActive) return;
            
            // Update viewport bounds IMMEDIATELY
            updateViewportImmediately();
            
            // Constrain cursor to section bounds
            const cursor = editor.getCursor();
            const currentSectionInfo = embedData.sectionInfo;
            
            if (cursor.line < currentSectionInfo.startLine) {
                isProgrammaticUpdate = true;
                editor.setCursor({ line: currentSectionInfo.startLine + 1, ch: 0 });
                isProgrammaticUpdate = false;
            } else if (cursor.line >= currentSectionInfo.endLine) {
                isProgrammaticUpdate = true;
                const lastEditableLine = currentSectionInfo.endLine - 1;
                const lastLineLength = editor.getLine(lastEditableLine)?.length || 0;
                editor.setCursor({ line: lastEditableLine, ch: lastLineLength });
                isProgrammaticUpdate = false;
            }
        };
        
        // CHANGED: Removed `requestAnimationFrame`. Updates must be synchronous to prevent a race condition
        // where the `input` event for typing a hash fires before the section bounds are updated.
        component.registerEvent(
            this.plugin.app.workspace.on('editor-change', (changedEditor) => {
                if (changedEditor === editor) {
                    constrainContent();
                }
            })
        );
        
        // Prevent scrolling outside section
        const cmScroller = view.containerEl.querySelector('.cm-scroller');
        if (cmScroller) {
            const preventScroll = (e) => {
                if (!embedData.viewportActive) return;
                
                const scrollTop = cmScroller.scrollTop;
                const lineHeight = editor.defaultTextHeight || 20;
                const firstVisibleLine = Math.floor(scrollTop / lineHeight);
                const currentSectionInfo = embedData.sectionInfo;
                
                // Constrain scrolling to section
                if (firstVisibleLine < Math.max(0, currentSectionInfo.startLine - 2)) {
                    cmScroller.scrollTop = Math.max(0, currentSectionInfo.startLine - 2) * lineHeight;
                } else if (firstVisibleLine > currentSectionInfo.endLine - 2) {
                    cmScroller.scrollTop = (currentSectionInfo.endLine - 2) * lineHeight;
                }
            };
            
            cmScroller.addEventListener('scroll', preventScroll);
            component.register(() => {
                cmScroller.removeEventListener('scroll', preventScroll);
            });
        }
    }

    scrollToSection(embedData) {
        const { view, editor, sectionInfo } = embedData;
        const { startLine } = sectionInfo;
        
        setTimeout(() => {
            // Scroll to the start of the section
            editor.scrollIntoView({ line: startLine, ch: 0 }, true);
            
            // Set cursor at line after header
            editor.setCursor({ line: startLine + 1, ch: 0 });
        }, 150);
    }

    findSectionBounds(content, sectionName) {
        const lines = content.split('\n');
        const escapedName = this.escapeRegExp(sectionName);
        const headerRegex = new RegExp(`^#{1,6}\\s+${escapedName}\\s*$`);
        
        let startLine = -1;
        let headerLevel = 0;

        // Find start of section
        for (let i = 0; i < lines.length; i++) {
            if (headerRegex.test(lines[i])) {
                startLine = i;
                headerLevel = (lines[i].match(/^#+/)?.[0] || '').length;
                break;
            }
        }

        if (startLine === -1) {
            return { startLine: -1, endLine: -1, headerLevel: 0 };
        }

        // Find end of section
        let endLine = lines.length;
        for (let i = startLine + 1; i < lines.length; i++) {
            const match = lines[i].match(/^#+/);
            if (match && match[0].length <= headerLevel) {
                endLine = i;
                break;
            }
        }

        return { startLine, endLine, headerLevel };
    }

    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    cleanupViewport(embedData) {
        if (embedData.viewportStyle) {
            embedData.viewportStyle.remove();
        }
        embedData.viewportActive = false;
    }
}

module.exports = ViewportController;