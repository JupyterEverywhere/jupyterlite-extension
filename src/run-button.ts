// Most of the code in this file was inspired by the following PRs in JupyterLab upstream:
// 1. https://github.com/jupyterlab/jupyterlab/pull/16602
// 2. https://github.com/jupyterlab/jupyterlab/pull/17775

// SPDX-License-Identifier: BSD-3-Clause

// JupyterLab uses a shared copyright model that enables all contributors to maintain
// the copyright on their contributions. All code is licensed under the terms of the
// revised BSD license.

// Copyright (c) 2015-2025 Project Jupyter Contributors
// All rights reserved.

// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:

// 1. Redistributions of source code must retain the above copyright notice, this
//    list of conditions and the following disclaimer.

// 2. Redistributions in binary form must reproduce the above copyright notice,
//    this list of conditions and the following disclaimer in the documentation
//    and/or other materials provided with the distribution.

// 3. Neither the name of the copyright holder nor the names of its
//    contributors may be used to endorse or promote products derived from
//    this software without specific prior written permission.

// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
// AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
// DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
// FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
// DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
// SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
// CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
// OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

import { JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { IEditorServices } from '@jupyterlab/codeeditor';
import { ToolbarButton } from '@jupyterlab/ui-components';
import { Widget, PanelLayout } from '@lumino/widgets';
import { Notebook, NotebookPanel, NotebookActions } from '@jupyterlab/notebook';
import { EverywhereIcons } from './icons';
import { Cell, CodeCell, ICellModel } from '@jupyterlab/cells';
import { Message } from '@lumino/messaging';

const INPUT_PROMPT_CLASS = 'jp-InputPrompt';
const INPUT_AREA_PROMPT_INDICATOR_CLASS = 'jp-InputArea-prompt-indicator';
const INPUT_AREA_PROMPT_INDICATOR_EMPTY_CLASS = 'jp-InputArea-prompt-indicator-empty';
const INPUT_AREA_PROMPT_RUN_CLASS = 'jp-InputArea-prompt-run';
const INPUT_AREA_PROMPT_STOP_CLASS = 'jp-InputArea-prompt-stop';

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
  private _promptIndicator: InputPromptIndicator;
  private _runButton: ToolbarButton;
  private _stopButton: ToolbarButton;
  private _ownerCell: CodeCell | null = null;

  constructor(private _app: JupyterFrontEnd) {
    super();
    this.addClass(INPUT_PROMPT_CLASS);

    const layout = (this.layout = new PanelLayout());
    this._promptIndicator = new InputPromptIndicator();
    layout.addWidget(this._promptIndicator);

    this._runButton = new ToolbarButton({
      icon: EverywhereIcons.runCell,
      onClick: () => {
        this._app.commands.execute('notebook:run-cell');
      },
      tooltip: 'Run this cell'
    });
    this._runButton.addClass(INPUT_AREA_PROMPT_RUN_CLASS);
    this._runButton.addClass('je-cell-run-button');
    layout.addWidget(this._runButton);

    this._stopButton = new ToolbarButton({
      icon: EverywhereIcons.stopCell,
      onClick: async () => {
        const panel = this._app.shell.currentWidget;
        if (!(panel instanceof NotebookPanel)) {
          return;
        }
        try {
          const kernel = panel.sessionContext.session?.kernel;
          if (kernel && typeof kernel.interrupt === 'function') {
            await kernel.interrupt();
          } else {
            await panel.sessionContext.restartKernel();
          }
        } catch (err) {
          console.warn('Failed to stop execution (interrupt/restart):', err);
        }
      },
      tooltip: 'Stop running this cell'
    });
    this._stopButton.addClass(INPUT_AREA_PROMPT_STOP_CLASS);
    this._stopButton.addClass('je-cell-stop-button');
    layout.addWidget(this._stopButton);

    this._applyPointerEvents(false);
  }

  /**
   * Make sure the correct button is clickable; we disable pointer events for
   * the hidden one to avoid the "wrong tooltip" and accidental clicks.
   */
  private _applyPointerEvents(isExecuting: boolean) {
    const runEl = this._runButton.node;
    const stopEl = this._stopButton.node;
    if (isExecuting) {
      runEl.style.pointerEvents = 'none';
      stopEl.style.pointerEvents = 'auto';
    } else {
      runEl.style.pointerEvents = 'auto';
      stopEl.style.pointerEvents = 'none';
    }
  }

  protected onAfterAttach(msg: Message): void {
    super.onAfterAttach(msg);

    let w: Widget | null = this.parent;
    while (w && !(w instanceof CodeCell)) {
      w = w.parent;
    }
    if (w instanceof CodeCell) {
      this._ownerCell = w;

      NotebookActions.executionScheduled.connect(this._onExecutionScheduled, this);
      NotebookActions.executed.connect(this._onExecuted, this);

      this._setExecuting(false);
    }
  }

  protected onBeforeDetach(msg: Message): void {
    super.onBeforeDetach(msg);
    if (this._ownerCell) {
      NotebookActions.executionScheduled.disconnect(this._onExecutionScheduled, this);
      NotebookActions.executed.disconnect(this._onExecuted, this);
    }
    this._ownerCell = null;
  }

  dispose(): void {
    if (this._ownerCell) {
      NotebookActions.executionScheduled.disconnect(this._onExecutionScheduled, this);
      NotebookActions.executed.disconnect(this._onExecuted, this);
      this._ownerCell = null;
    }
    super.dispose();
  }

  // Per-cell execution state handler
  private _onExecutionScheduled(
    _sender: unknown,
    args: { notebook: Notebook; cell: Cell<ICellModel> }
  ) {
    if (this._ownerCell && args.cell === this._ownerCell) {
      this._setExecuting(true);
    }
  }

  private _onExecuted(
    _sender: unknown,
    args: { notebook: Notebook; cell: Cell<ICellModel>; success: boolean; error?: unknown }
  ) {
    if (this._ownerCell && args.cell === this._ownerCell) {
      this._setExecuting(false);
    }
  }

  private _setExecuting(flag: boolean) {
    this.toggleClass('je-executing', flag);
    if (this._ownerCell) {
      this._ownerCell.toggleClass('je-executing', flag);
    }
    this._applyPointerEvents(flag);
  }

  get executionCount(): string | null {
    return this._customExecutionCount;
  }

  set executionCount(value: string | null) {
    this._customExecutionCount = value;
    this._promptIndicator.executionCount = value;
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
