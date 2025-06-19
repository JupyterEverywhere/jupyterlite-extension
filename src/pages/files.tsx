import { JupyterFrontEndPlugin, JupyterFrontEnd } from '@jupyterlab/application';
import { MainAreaWidget, ReactWidget } from '@jupyterlab/apputils';
import { Commands } from '../commands';
import { SidebarIcon } from '../ui-components/SidebarIcon';
import { PageTitle } from '../ui-components/PageTitle';
import { EverywhereIcons } from '../icons';
import React from 'react';
import { LabIcon } from '@jupyterlab/ui-components';

function Tile(props: { icon: LabIcon; label: string }) {
  return (
    <button className="je-Tile">
      <div className="je-Tile-icon">
        <props.icon.react />
      </div>
      {props.label}
    </button>
  );
}

class Files extends ReactWidget {
  constructor() {
    super();
    this.addClass('je-Files');
  }
  protected render() {
    return (
      <div>
        <Tile icon={EverywhereIcons.addFile} label="add new" />
      </div>
    );
  }
}

export const files: JupyterFrontEndPlugin<void> = {
  id: 'jupytereverywhere:files',
  autoStart: true,
  activate: (app: JupyterFrontEnd) => {
    const newWidget = () => {
      const content = new Files();
      const widget = new MainAreaWidget({ content });
      widget.id = 'je-files';
      widget.title.label = 'Files';
      widget.title.closable = true;
      widget.title.icon = EverywhereIcons.folder;
      const toolbarTitle = new PageTitle({
        label: 'Files',
        icon: EverywhereIcons.folder
      });
      widget.toolbar.addItem('title', toolbarTitle);
      return widget;
    };
    let widget = newWidget();

    app.shell.add(
      new SidebarIcon({
        label: 'Files',
        icon: EverywhereIcons.folderSidebar,
        execute: () => {
          app.commands.execute(Commands.openFiles);
        }
      }),
      'left',
      { rank: 200 }
    );

    app.commands.addCommand(Commands.openFiles, {
      label: 'Open Files',
      execute: () => {
        // Regenerate the widget if disposed
        if (widget.isDisposed) {
          widget = newWidget();
        }
        if (!widget.isAttached) {
          // Attach the widget to the main work area if it's not there
          app.shell.add(widget, 'main');
        }
        app.shell.activateById(widget.id);
      }
    });
  }
};
