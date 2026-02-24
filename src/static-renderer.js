const { Component, MarkdownRenderer } = require('obsidian');

class StaticRenderer {
    constructor(plugin) {
        this.plugin = plugin;
    }

    async render(container, results, ctx, onClickResult) {
        container.empty();
        container.addClass('sync-container');

        const component = new Component();
        component.load();
        ctx.addChild(component);

        if (!results.length) {
            container.createDiv('sync-empty').setText('No matching blocks found for sync-query.');
            return;
        }

        for (const result of results) {
            const item = container.createDiv('sync-embed-static');
            item.dataset.file = result.file.path;
            item.tabIndex = 0;
            await this.renderResultIntoElement(item, result, ctx, component);

            const clickHandler = async (event) => {
                event.preventDefault();
                event.stopPropagation();
                await onClickResult(result, item);
            };

            item.addEventListener('click', clickHandler);
            const keydownHandler = async (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    await clickHandler(event);
                }
            };

            item.addEventListener('keydown', keydownHandler);

            component.register(() => {
                item.removeEventListener('click', clickHandler);
                item.removeEventListener('keydown', keydownHandler);
            });
        }
    }

    async renderResultIntoElement(element, result, ctx, component = null) {
        let renderComponent = component;
        if (!renderComponent) {
            renderComponent = new Component();
            renderComponent.load();
            ctx.addChild(renderComponent);
        }
        element.empty();
        const body = element.createDiv('sync-embed-static-body');
        await MarkdownRenderer.renderMarkdown(result.originalText, body, ctx.sourcePath, renderComponent);
    }
}

module.exports = StaticRenderer;
