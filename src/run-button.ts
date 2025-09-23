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

import { JupyterFrontEnd } from '@jupyterlab/application';
import { ToolbarButton } from '@jupyterlab/ui-components';
import { Widget, PanelLayout } from '@lumino/widgets';
import { EverywhereIcons } from './icons';

const INPUT_PROMPT_CLASS = 'jp-InputPrompt';
const INPUT_AREA_PROMPT_INDICATOR_CLASS = 'jp-InputArea-prompt-indicator';
const INPUT_AREA_PROMPT_INDICATOR_EMPTY_CLASS = 'jp-InputArea-prompt-indicator-empty';
const INPUT_AREA_PROMPT_RUN_CLASS = 'jp-InputArea-prompt-run';

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
  }

  get executionCount(): string | null {
    return this._customExecutionCount;
  }

  set executionCount(value: string | null) {
    this._customExecutionCount = value;
    this._promptIndicator.executionCount = value;
  }
}
