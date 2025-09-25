import { JupyterFrontEndPlugin, JupyterFrontEnd } from '@jupyterlab/application';
import { MainAreaWidget, ReactWidget } from '@jupyterlab/apputils';
import { Commands } from '../commands';
import { SidebarIcon } from '../ui-components/SidebarIcon';
import { PageTitle } from '../ui-components/PageTitle';
import { EverywhereIcons } from '../icons';
import React from 'react';

export class Competitions extends ReactWidget {
  constructor() {
    super();
    this.addClass('je-Competitions');
  }
  protected render() {
    return <div>TBD</div>;
  }
}
export const competitions: JupyterFrontEndPlugin<void> = {
  id: 'jupytereverywhere:competitions',
  autoStart: true,
  activate: (app: JupyterFrontEnd) => {
    const newWidget = () => {
      const content = new Competitions();
      const widget = new MainAreaWidget({ content });
      widget.id = 'je-competitions';
      widget.title.label = 'Competitions';
      widget.title.closable = true;
      widget.title.icon = EverywhereIcons.competition;
      const toolbarTitle = new PageTitle({
        label: 'Competitions',
        icon: EverywhereIcons.competition
      });
      widget.toolbar.addItem('title', toolbarTitle);
      return widget;
    };
    let widget = newWidget();

    app.shell.add(
      new SidebarIcon({
        label: 'Competition',
        icon: EverywhereIcons.competition,
        execute: () => {
          void app.commands.execute(Commands.openCompetitions);
          return;
        }
      }),
      'left',
      { rank: 300 }
    );

    app.commands.addCommand(Commands.openCompetitions, {
      label: 'Open Competitions',
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
