const { Notice } = require('obsidian');

class ViewportController {
    constructor(plugin) {
        this.plugin = plugin;
    }

    async setupSectionViewport(embedData) {
        const { view, editor, file, section } = embedData;

        await new Promise(resolve => setTimeout(resolve, 100));

        const content = editor.getValue();
        const sectionInfo = this.findSectionBounds(content, section);

        if (sectionInfo.startLine === -1) {
            console.warn('Sync Embeds: Section not found for viewport embedding:', section);
            return;
        }

        embedData.sectionInfo = sectionInfo;
        embedData.viewportActive = true;

        this.applyViewportRestriction(embedData);
        this.setupBoundaryProtection(embedData);
        this.setupHeaderInputInterception(embedData);
        this.setupContentConstraints(embedData);
        this.scrollToSection(embedData);
    }

    async setupBlockViewport(embedData, startLine, endLine) {
        await new Promise(resolve => setTimeout(resolve, 100));

        embedData.sectionInfo = {
            startLine,
            endLine,
            headerLevel: 0
        };
        embedData.viewportActive = true;

        this.applyViewportRestriction(embedData);
        this.setupBoundaryProtection(embedData);
        this.setupContentConstraints(embedData);
        this.scrollToSection(embedData);
    }

    applyViewportRestriction(embedData) {
        const { view } = embedData;
        
        const style = document.createElement('style');
        style.className = 'sync-viewport-style';

        const embedId = 'embed-' + Math.random().toString(36).substr(2, 9);
        view.containerEl.setAttribute('data-embed-id', embedId);
        embedData.embedId = embedId;

        this.updateViewportCSS(embedData, style);
        view.containerEl.appendChild(style);
        embedData.viewportStyle = style;
    }

    updateViewportCSS(embedData, style) {
        const { sectionInfo, embedId, file } = embedData;
        const { startLine, endLine } = sectionInfo;

        // Frontmatter DOM Offset compensation
        // CodeMirror folds frontmatter, removing all but ONE line from the DOM.
        let domOffset = 0;
        const fileCache = this.plugin.app.metadataCache.getFileCache(file);
        if (fileCache && fileCache.frontmatterPosition) {
            // No +1 needed because the first line is retained by CM6 for the fold widget
            domOffset = fileCache.frontmatterPosition.end.line;
        }

        const domStartLine = Math.max(0, startLine - domOffset);
        const domEndLine = Math.max(0, endLine - domOffset);

        const css = `
            /* Hide all lines BEFORE and INCLUDING the section header */
            [data-embed-id="${embedId}"] .cm-line:nth-child(-n+${domStartLine + 1}) {
                display: none !important;
            }

            /* Hide all lines AFTER the section */
            [data-embed-id="${embedId}"] .cm-line:nth-child(n+${domEndLine + 1}) {
                display: none !important;
            }
        `;

        style.textContent = css;
    }

    setupBoundaryProtection(embedData) {
        const { view, editor, component } = embedData;

        const setupHandlers = () => {
            const cmEditor = view.containerEl.querySelector('.cm-content');
            if (!cmEditor) {
                setTimeout(setupHandlers, 50);
                return;
            }

            const keydownHandler = (event) => {
                if (!embedData.viewportActive || !embedData.sectionInfo) return;

                const { startLine, endLine } = embedData.sectionInfo;
                const cursor = editor.getCursor();
                const selection = editor.getSelection();

                // PROTECT TOP BOUNDARY (Block Backspace from deleting the invisible boundary newline)
                if (event.key === 'Backspace') {
                    if (selection) {
                        const from = editor.getCursor('from');
                        if (from.line <= startLine) {
                            event.preventDefault();
                            return;
                        }
                    } else {
                        if (cursor.line === startLine + 1 && cursor.ch === 0) {
                            event.preventDefault();
                            return;
                        }
                    }
                }

                // PROTECT BOTTOM BOUNDARY (Block Delete from deleting the invisible boundary newline)
                if (event.key === 'Delete') {
                    if (selection) {
                        const to = editor.getCursor('to');
                        if (to.line >= endLine) {
                            event.preventDefault();
                            return;
                        }
                    } else {
                        const lastEditableLine = endLine - 1;
                        const lastLineLength = editor.getLine(lastEditableLine)?.length || 0;
                        if (cursor.line === lastEditableLine && cursor.ch === lastLineLength) {
                            event.preventDefault();
                            return;
                        }
                    }
                }
            };

            cmEditor.addEventListener('keydown', keydownHandler, true);
            component.register(() => {
                cmEditor.removeEventListener('keydown', keydownHandler, true);
            });
        };

        setTimeout(setupHandlers, 100);
    }

    setupHeaderInputInterception(embedData) {
        const { view, editor, component } = embedData;
        const { headerLevel } = embedData.sectionInfo;
        if (!headerLevel) return;

        let lastNoticeTime = 0;
        const noticeDebounce = 5000;

        const setupHandlers = () => {
            const cmEditor = view.containerEl.querySelector('.cm-content');
            if (!cmEditor) {
                setTimeout(setupHandlers, 50);
                return;
            }

            const inputHandler = (event) => {
                if (event.inputType !== 'insertText' && event.inputType !== 'insertFromPaste') return;
                if (event.data !== '#') return;

                const cursor = editor.getCursor();
                const line = editor.getLine(cursor.line);
                const beforeHash = line.substring(0, cursor.ch - 1);
                const isAtLineStart = /^\s*$/.test(beforeHash);

                if (isAtLineStart &&
                    cursor.line > embedData.sectionInfo.startLine &&
                    cursor.line < embedData.sectionInfo.endLine) {

                    const currentLine = editor.getLine(cursor.line);
                    const newLine = currentLine.substring(0, cursor.ch - 1) + currentLine.substring(cursor.ch);
                    editor.replaceRange(
                        newLine,
                        { line: cursor.line, ch: 0 },
                        { line: cursor.line, ch: currentLine.length }
                    );
                    editor.setCursor({ line: cursor.line, ch: cursor.ch - 1 });

                    const now = Date.now();
                    if (this.plugin.settings.showHeaderHints &&
                        now - lastNoticeTime > noticeDebounce) {
                        lastNoticeTime = now;
                        const availableLevels = [];
                        for (let i = headerLevel + 1; i <= 6; i++) {
                            availableLevels.push(`H${i} (Alt+${i})`);
                        }
                        new Notice(`⚠️ Cannot create H1-H${headerLevel} headers in this section.\nUse: ${availableLevels.join(', ')}`, 5000);
                    }
                }
            };

            const pasteHandler = (event) => {
                const clipboardData = event.clipboardData?.getData('text');
                if (!clipboardData) return;

                const cursor = editor.getCursor();
                if (cursor.line > embedData.sectionInfo.startLine &&
                    cursor.line < embedData.sectionInfo.endLine) {

                    const lines = clipboardData.split('\n');
                    let hasInvalidHeaders = false;

                    const adjustedLines = lines.map(line => {
                        const match = line.match(/^(#{1,6})\s+(.*)$/);
                        if (!match) return line;

                        const [, hashes, content] = match;
                        if (hashes.length <= headerLevel) {
                            hasInvalidHeaders = true;
                            return '#'.repeat(headerLevel + 1) + ' ' + content;
                        }
                        return line;
                    });

                    if (hasInvalidHeaders) {
                        event.preventDefault();
                        if (this.plugin.settings.showHeaderHints) {
                            new Notice('Pasted headers adjusted to maintain section hierarchy', 4000);
                        }
                        editor.replaceSelection(adjustedLines.join('\n'));
                    }
                }
            };

            cmEditor.addEventListener('input', inputHandler, true);
            cmEditor.addEventListener('paste', pasteHandler, true);

            component.register(() => {
                cmEditor.removeEventListener('input', inputHandler, true);
                cmEditor.removeEventListener('paste', pasteHandler, true);
            });
        };

        setTimeout(setupHandlers, 100);
    }

    setupContentConstraints(embedData) {
        const { view, editor, component } = embedData;
        let isProgrammaticUpdate = false;

        // Force cursor strictly inside bounds (preventing up/down arrow drifting)
        const enforceCursorBounds = () => {
            if (isProgrammaticUpdate || !embedData.viewportActive || !embedData.sectionInfo) return;

            const { startLine, endLine } = embedData.sectionInfo;
            const cursor = editor.getCursor();

            if (cursor.line <= startLine) {
                isProgrammaticUpdate = true;
                editor.setCursor({ line: startLine + 1, ch: 0 });
                isProgrammaticUpdate = false;
            } else if (cursor.line >= endLine) {
                isProgrammaticUpdate = true;
                const lastEditableLine = endLine - 1;
                const lastLineLength = editor.getLine(lastEditableLine)?.length || 0;
                editor.setCursor({ line: lastEditableLine, ch: lastLineLength });
                isProgrammaticUpdate = false;
            }
        };

        const setupDOMListeners = () => {
            const cmContent = view.containerEl.querySelector('.cm-content');
            if (!cmContent) {
                setTimeout(setupDOMListeners, 50);
                return;
            }

            cmContent.addEventListener('mouseup', enforceCursorBounds);
            cmContent.addEventListener('focusin', enforceCursorBounds);
            cmContent.addEventListener('keyup', (e) => {
                if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
                    enforceCursorBounds();
                }
            });

            component.register(() => {
                cmContent.removeEventListener('mouseup', enforceCursorBounds);
                cmContent.removeEventListener('focusin', enforceCursorBounds);
                cmContent.removeEventListener('keyup', enforceCursorBounds);
            });
        };

        setTimeout(setupDOMListeners, 100);

        // Retain text-change bounds checking
        component.registerEvent(
            this.plugin.app.workspace.on('editor-change', (changedEditor) => {
                if (changedEditor === editor) {
                    this.updateViewportImmediately(embedData);
                    enforceCursorBounds();
                }
            })
        );

        const cmScroller = view.containerEl.querySelector('.cm-scroller');
        if (cmScroller) {
            const preventScroll = (e) => {
                if (!embedData.viewportActive) return;

                const scrollTop = cmScroller.scrollTop;
                const lineHeight = editor.defaultTextHeight || 20;
                const firstVisibleLine = Math.floor(scrollTop / lineHeight);
                
                // Frontmatter DOM Offset compensation for scrolling bounds
                let domOffset = 0;
                const fileCache = this.plugin.app.metadataCache.getFileCache(embedData.file);
                if (fileCache && fileCache.frontmatterPosition) {
                    domOffset = fileCache.frontmatterPosition.end.line;
                }
                
                const domStartLine = Math.max(0, embedData.sectionInfo.startLine - domOffset);
                const domEndLine = Math.max(0, embedData.sectionInfo.endLine - domOffset);

                if (firstVisibleLine < Math.max(0, domStartLine - 2)) {
                    cmScroller.scrollTop = Math.max(0, domStartLine - 2) * lineHeight;
                } else if (firstVisibleLine > domEndLine - 2) {
                    cmScroller.scrollTop = (domEndLine - 2) * lineHeight;
                }
            };

            cmScroller.addEventListener('scroll', preventScroll);
            component.register(() => {
                cmScroller.removeEventListener('scroll', preventScroll);
            });
        }
    }

    updateViewportImmediately(embedData) {
        if (!embedData.viewportActive) return;

        if (embedData.mode === 'block' && embedData.blockBounds) {
            embedData.sectionInfo = {
                startLine: embedData.blockBounds.startLine,
                endLine: embedData.blockBounds.endLine,
                headerLevel: 0
            };
            if (embedData.viewportStyle) this.updateViewportCSS(embedData, embedData.viewportStyle);
            return;
        }

        const currentContent = embedData.editor.getValue();
        const newSectionInfo = this.findSectionBounds(currentContent, embedData.section);

        if (newSectionInfo.startLine !== -1) {
            embedData.sectionInfo = newSectionInfo;

            if (embedData.viewportStyle) {
                this.updateViewportCSS(embedData, embedData.viewportStyle);
            }
        }
    }

    scrollToSection(embedData) {
        const { editor, sectionInfo } = embedData;
        const { startLine } = sectionInfo;

        setTimeout(() => {
            editor.scrollIntoView({ line: startLine + 1, ch: 0 }, true);
            editor.setCursor({ line: startLine + 1, ch: 0 });
        }, 150);
    }

    findSectionBounds(content, sectionName) {
        const lines = content.split('\n');
        const escapedName = this.escapeRegExp(sectionName);
        const headerRegex = new RegExp(`^#{1,6}\\s+${escapedName}\\s*$`);

        let startLine = -1;
        let headerLevel = 0;

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
