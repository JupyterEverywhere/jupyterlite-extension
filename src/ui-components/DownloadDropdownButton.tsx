import { ReactWidget, ToolbarButtonComponent } from '@jupyterlab/ui-components';
import { CommandRegistry } from '@lumino/commands';
import { UUID } from '@lumino/coreutils';
import { Menu } from '@lumino/widgets';
import React from 'react';
import { EverywhereIcons } from '../icons';

export class DownloadDropdownButton extends ReactWidget {
  constructor(commands: CommandRegistry) {
    super();
    this.addClass('jp-Toolbar-item');
    this.addClass('jp-Toolbar-button');

    this._menu = new Menu({ commands });
    this._menu.addClass('je-DownloadDropdownButton-menu');
    this._menu.addClass('je-DropdownMenu');
    this._menu.addItem({ command: 'jupytereverywhere:download-pdf' });
    this._menu.addItem({ command: 'jupytereverywhere:download-notebook' });
    this._menu.id = UUID.uuid4();
  }

  render(): React.ReactElement {
    return (
      <ToolbarButtonComponent
        className="je-DownloadButton"
        icon={EverywhereIcons.downloadCaret}
        label="Download"
        tooltip="Download notebook"
        onClick={this._showMenu.bind(this)}
        // Aria attributes will only work once https://github.com/jupyterlab/jupyterlab/issues/18037 is solved and dependencies are updated
        aria-expanded={this._menu.isVisible}
        aria-controls={this._menu.id}
        aria-haspopup={true}
      />
    );
  }

  private _showMenu(): void {
    const node = this.node.querySelector('jp-button') ?? this.node;
    const rect = node.getBoundingClientRect();
    this._menu.open(rect.left, rect.top - 4);
  }

  private _menu: Menu;
}
