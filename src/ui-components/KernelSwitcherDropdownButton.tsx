import React from 'react';
import { Menu } from '@lumino/widgets';
import { ToolbarButtonComponent, ReactWidget } from '@jupyterlab/ui-components';
import { EverywhereIcons } from '../icons';
import { CommandRegistry } from '@lumino/commands';
import { KERNEL_DISPLAY_NAMES } from '../kernels';
import { INotebookTracker } from '@jupyterlab/notebook';

export class KernelSwitcherDropdownButton extends ReactWidget {
  private _tracker: INotebookTracker;
  constructor(commands: CommandRegistry, tracker: INotebookTracker) {
    super();
    this.addClass('jp-Toolbar-item');
    this.addClass('jp-Toolbar-button');

    this._tracker = tracker;

    this._menu = new Menu({ commands });
    this._menu.addClass('je-KernelSwitcherDropdownButton-menu');
  }

  render(): React.ReactElement {
    const currentKernel = this._tracker.currentWidget?.sessionContext.session?.kernel?.name;
    const label = KERNEL_DISPLAY_NAMES[currentKernel ?? ''] ?? 'Select Kernel';
    return (
      <ToolbarButtonComponent
        className="je-KernelSwitcherButton"
        icon={EverywhereIcons.kernelCaret}
        label={label}
        tooltip="Switch between Python and R memories"
        onClick={() => this._showMenu.bind(this)()}
      />
    );
  }

  private _showMenu(): void {
    const currentKernel = this._tracker.currentWidget?.sessionContext.session?.kernel?.name;

    const allKernels = ['python', 'xr'];

    // We order the kernels, so that the current kernel appears first
    // in the dropdown.
    const orderedKernels = currentKernel
      ? [currentKernel, ...allKernels.filter(k => k !== currentKernel)]
      : allKernels;

    this._menu.clearItems();

    for (const kernel of orderedKernels) {
      this._menu.addItem({
        command: 'jupytereverywhere:switch-kernel',
        args: { kernel }
      });
    }

    const rect = this.node.getBoundingClientRect();
    this._menu.open(rect.left, rect.top);
  }

  private _menu: Menu;
}
