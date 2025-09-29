import { placeholder } from '@codemirror/view';
import { JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { MarkdownCell } from '@jupyterlab/cells';
import { EditorExtensionRegistry, IEditorExtensionRegistry } from '@jupyterlab/codemirror';
import { MimeModel } from '@jupyterlab/rendermime';

export const EMPTY_MARKDOWN_PLACEHOLDER = 'This is a text cell. Double-click to edit.';

export const placeholderPlugin: JupyterFrontEndPlugin<void> = {
  id: '@jupyter-everywhere/codemirror-extension:placeholder',
  autoStart: true,
  requires: [IEditorExtensionRegistry],
  activate: (app: JupyterFrontEnd, extensions: IEditorExtensionRegistry) => {
    extensions.addExtension(
      Object.freeze({
        name: 'placeholder',
        default: null,
        factory: () =>
          EditorExtensionRegistry.createConfigurableExtension((text: string | null) =>
            text ? placeholder(text) : []
          ),
        schema: {
          type: ['string', 'null'],
          title: 'Placeholder',
          description: 'Placeholder to show.'
        }
      })
    );
  }
};

export class MarkdownCellWithCustomPlaceholder extends MarkdownCell {
  constructor(options: MarkdownCellWithCustomPlaceholder.IOptions) {
    super(options);
    this._emptyPlaceholder = options.emptyPlaceholder;
  }
  updateRenderedInput(): Promise<void> {
    if (this.placeholder) {
      return Promise.resolve();
    }

    const model = this.model;
    const text = (model && model.sharedModel.getSource()) || this._emptyPlaceholder;
    // Do not re-render if the text has not changed.
    if (text !== this._previousText) {
      const mimeModel = new MimeModel({ data: { 'text/markdown': text } });
      this._previousText = text;
      return this.renderer.renderModel(mimeModel);
    }
    return Promise.resolve();
  }
  private _previousText: string = '';
  private _emptyPlaceholder: string;
}

namespace MarkdownCellWithCustomPlaceholder {
  export interface IOptions extends MarkdownCell.IOptions {
    emptyPlaceholder: string;
  }
}
