import { JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { MarkdownCell } from '@jupyterlab/cells';
import { IEditorServices } from '@jupyterlab/codeeditor';
import { Notebook, NotebookPanel } from '@jupyterlab/notebook';
import { EMPTY_MARKDOWN_PLACEHOLDER, MarkdownCellWithCustomPlaceholder } from './placeholders';
import { JEInputPrompt } from './run-button';

export namespace JENotebookContentFactory {
  export interface IOptions extends Notebook.ContentFactory.IOptions {
    app: JupyterFrontEnd;
  }
}

export class JENotebookContentFactory extends Notebook.ContentFactory {
  private _app: JupyterFrontEnd;

  constructor(options: JENotebookContentFactory.IOptions) {
    super(options);
    this._app = options.app;
  }

  createInputPrompt(): JEInputPrompt {
    return new JEInputPrompt(this._app);
  }

  createNotebook(options: Notebook.IOptions): Notebook {
    return new Notebook(options);
  }

  createMarkdownCell(options: MarkdownCell.IOptions): MarkdownCell {
    const cell = new MarkdownCellWithCustomPlaceholder({
      ...options,
      emptyPlaceholder: EMPTY_MARKDOWN_PLACEHOLDER
    }).initializeState();
    // Monkey patch until https://github.com/jupyterlab/jupyterlab/issues/17917 is solved
    cell['_updateRenderedInput'] = cell['updateRenderedInput'];
    return cell;
  }
}

/**
 * Plugin that provides the custom notebook factory.
 */
export const notebookFactoryPlugin: JupyterFrontEndPlugin<NotebookPanel.IContentFactory> = {
  id: 'jupytereverywhere:notebook-factory',
  description: 'Provides notebook cell factory with input prompts',
  provides: NotebookPanel.IContentFactory,
  requires: [IEditorServices],
  autoStart: true,
  activate: (app: JupyterFrontEnd, editorServices: IEditorServices) => {
    const editorFactory = editorServices.factoryService.newInlineEditor;

    const factory = new JENotebookContentFactory({
      editorFactory,
      app
    });

    return factory;
  }
};
