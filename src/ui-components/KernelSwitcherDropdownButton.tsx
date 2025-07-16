import React from 'react';
import { Menu } from '@lumino/widgets';
import { ToolbarButtonComponent, ReactWidget } from '@jupyterlab/ui-components';
import { EverywhereIcons } from '../icons';
import { CommandRegistry } from '@lumino/commands';

export class KernelSwitcherDropdownButton extends ReactWidget {
  constructor(commands: CommandRegistry) {
    super();
    this.addClass('jp-Toolbar-item');
    this.addClass('jp-Toolbar-button');

    this._menu = new Menu({ commands });
    this._menu.addClass('je-KernelSwitcherDropdownButton-menu');

    this._menu.addItem({
      command: 'jupytereverywhere:switch-to-python'
    });
    this._menu.addItem({
      command: 'jupytereverywhere:switch-to-r'
    });
  }

  render(): React.ReactElement {
    return (
      <ToolbarButtonComponent
        className="je-KernelSwitcherButton"
        icon={EverywhereIcons.fastForward}
        label="Kernel"
        tooltip="Switch kernel"
        onClick={() => this._showMenu()}
      />
    );
  }

  private _showMenu(): void {
    const rect = this.node.getBoundingClientRect();
    this._menu.open(rect.left, rect.top);
  }

  private _menu: Menu;
}
