import { JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { IEditorServices } from '@jupyterlab/codeeditor';
import { ToolbarButton } from '@jupyterlab/ui-components';
import { Widget, PanelLayout } from '@lumino/widgets';
import { Message } from '@lumino/messaging';
import { Notebook, NotebookPanel } from '@jupyterlab/notebook';
import { EverywhereIcons } from './icons';

const INPUT_PROMPT_CLASS = 'jp-InputPrompt';
const INPUT_AREA_PROMPT_INDICATOR_CLASS = 'jp-InputArea-prompt-indicator';
const INPUT_AREA_PROMPT_INDICATOR_EMPTY_CLASS = 'jp-InputArea-prompt-indicator-empty';
const INPUT_AREA_PROMPT_RUN_CLASS = 'jp-InputArea-prompt-run';
// TODO licensing stuff here

export interface IInputPromptIndicator extends Widget {
  executionCount: string | null;
}

export interface IInputPrompt extends IInputPromptIndicator {
  runButton?: ToolbarButton;
}

export class InputPromptIndicator extends Widget implements IInputPromptIndicator {
  private _executionCount: string | null = null;

  constructor() {
    super();
    this.addClass(INPUT_AREA_PROMPT_INDICATOR_CLASS);
  }

  get executionCount(): string | null {
    return this._executionCount;
  }

  set executionCount(value: string | null) {
    this._executionCount = value;
    if (value) {
      this.node.textContent = `[${value}]:`;
      this.removeClass(INPUT_AREA_PROMPT_INDICATOR_EMPTY_CLASS);
    } else {
      this.node.textContent = '[ ]:';
      this.addClass(INPUT_AREA_PROMPT_INDICATOR_EMPTY_CLASS);
    }
  }
}

export class JEInputPrompt extends Widget implements IInputPrompt {
  private _customExecutionCount: string | null = null;
  private _isHovered: boolean = false;
  private _promptIndicator: InputPromptIndicator;
  private _runButton: ToolbarButton;

  constructor(private _app: JupyterFrontEnd) {
    super();
    this.addClass(INPUT_PROMPT_CLASS);

    const layout = (this.layout = new PanelLayout());
    this._promptIndicator = new InputPromptIndicator();
    layout.addWidget(this._promptIndicator);
    this._runButton = new ToolbarButton({
      icon: EverywhereIcons.run,
      onClick: () => {
        this._app.commands.execute('notebook:run-cell');
      },
      tooltip: 'Run this cell'
    });
    this._runButton.addClass(INPUT_AREA_PROMPT_RUN_CLASS);
    this._runButton.addClass('je-cell-run-button');
    layout.addWidget(this._runButton);
    this.updateRunButtonVisibility();
  }

  get executionCount(): string | null {
    return this._customExecutionCount;
  }

  set executionCount(value: string | null) {
    this._customExecutionCount = value;
    this._promptIndicator.executionCount = value;
    this.updateRunButtonVisibility();
  }

  /**
   * Handle DOM events; unsure if we'll keep them...
   */
  handleEvent(event: Event): void {
    switch (event.type) {
      case 'mouseover':
        this._isHovered = true;
        this.updateRunButtonVisibility();
        break;
      case 'mouseout':
        this._isHovered = false;
        this.updateRunButtonVisibility();
        break;
    }
  }

  protected onAfterAttach(msg: Message): void {
    super.onAfterAttach(msg);
    this.node.addEventListener('mouseover', this, true);
    this.node.addEventListener('mouseout', this, true);
  }

  protected onBeforeDetach(msg: Message): void {
    super.onBeforeDetach(msg);
    this.node.removeEventListener('mouseover', this, true);
    this.node.removeEventListener('mouseout', this, true);
  }

  private updateRunButtonVisibility(): void {
    if (!this._runButton) {
      return;
    }

    // Show run button on hover or if cell hasn't been executed
    if (this._isHovered || !this.executionCount) {
      this._runButton.show();
      this._promptIndicator.hide();
    } else {
      this._runButton.hide();
      this._promptIndicator.show();
    }
  }
}

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
}

/**
 * Plugin that provides the custom notebook factory with run buttons
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
