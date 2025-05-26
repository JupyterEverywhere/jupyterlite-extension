import { caretDownIcon, ToolbarButtonComponent } from '@jupyterlab/ui-components';
import { Menu } from '@lumino/widgets';
import { ReactWidget } from '@jupyterlab/apputils';
import { CommandRegistry } from '@lumino/commands';

import React from 'react';

export class DownloadDropdownButton extends ReactWidget {
  constructor(commands: CommandRegistry) {
    super();
    this.addClass('jp-Toolbar-item');
    this.addClass('jp-Toolbar-button');

    this._menu = new Menu({ commands });
    this._menu.addClass('jp-DownloadDropdownButton-menu');
    this._menu.addItem({ command: 'jupytereverywhere:download-notebook' });
    this._menu.addItem({ command: 'jupytereverywhere:download-pdf' });
  }

  render(): React.ReactElement {
    return (
      <ToolbarButtonComponent
        className="je-DownloadButton"
        icon={caretDownIcon}
        label="Download"
        tooltip="Download notebook"
        onClick={this._showMenu.bind(this)}
      />
    );
  }

  private _showMenu(): void {
    const rect = this.node.getBoundingClientRect();
    this._menu.open(rect.left, rect.bottom);
  }

  private _menu: Menu;
}
