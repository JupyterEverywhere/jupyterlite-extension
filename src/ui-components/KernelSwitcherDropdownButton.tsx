import React from 'react';
import { Menu } from '@lumino/widgets';
import { Message } from '@lumino/messaging';
import { ToolbarButtonComponent, ReactWidget } from '@jupyterlab/ui-components';
import { EverywhereIcons } from '../icons';
import { CommandRegistry } from '@lumino/commands';
import { KERNEL_DISPLAY_NAMES } from '../kernels';
import { INotebookTracker } from '@jupyterlab/notebook';

export class KernelSwitcherDropdownButton extends ReactWidget {
  private _tracker: INotebookTracker;
  private _currentKernelName: string | null = null;
  private _menu: Menu;

  constructor(commands: CommandRegistry, tracker: INotebookTracker) {
    super();
    this.addClass('jp-Toolbar-item');
    this.addClass('jp-Toolbar-button');

    this._tracker = tracker;
    this._menu = new Menu({ commands });
    this._menu.addClass('je-KernelSwitcherDropdownButton-menu');
  }

  onAfterAttach(msg: Message): void {
    super.onAfterAttach(msg);
    this._tracker.currentChanged.connect(this._onActiveNotebookChanged, this);
    this._onActiveNotebookChanged();
  }

  private _onActiveNotebookChanged(): void {
    const panel = this._tracker.currentWidget;

    if (!panel) {
      this._currentKernelName = null;
      this.update();
      return;
    }

    panel.sessionContext.kernelChanged.connect(this._onKernelChanged, this);

    this._currentKernelName = panel.sessionContext.session?.kernel?.name || null;
    this.update();
  }

  private _onKernelChanged(): void {
    const panel = this._tracker.currentWidget;

    if (!panel) {
      this._currentKernelName = null;
      this.update();
      return;
    }

    this._currentKernelName = panel.sessionContext.session?.kernel?.name || null;
    this.update();
  }

  render(): React.ReactElement {
    const label = KERNEL_DISPLAY_NAMES[this._currentKernelName ?? ''] ?? 'Select Kernel';

    return (
      <ToolbarButtonComponent
        className="je-KernelSwitcherButton"
        icon={EverywhereIcons.kernelCaret}
        label={label}
        tooltip="Switch coding language"
        onClick={() => this._showMenu()}
      />
    );
  }

  private _showMenu(): void {
    const currentKernel = this._tracker.currentWidget?.sessionContext.session?.kernel?.name;

    const allKernels = Object.keys(KERNEL_DISPLAY_NAMES);

    // We order the kernels, so that the current kernel appears first
    // in the dropdown.
    const orderedKernels = currentKernel
      ? [currentKernel, ...allKernels.filter(k => k !== currentKernel)]
      : allKernels;

    this._menu.clearItems();

    for (const kernel of orderedKernels) {
      const isActive = kernel === currentKernel;
      this._menu.addItem({
        command: 'jupytereverywhere:switch-kernel',
        args: { kernel, isActive }
      });
    }

    const rect = this.node.getBoundingClientRect();
    this._menu.open(rect.left, rect.top);
  }
}
