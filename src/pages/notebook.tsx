import { JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { INotebookTracker } from '@jupyterlab/notebook';
import { SidebarIcon } from '../ui-components/SidebarIcon';
import { EverywhereIcons } from '../icons';
import { ToolbarButton } from '@jupyterlab/apputils';
import { DownloadDropdownButton } from '../ui-components/DownloadDropdownButton';
import { Commands } from '../commands';

export const notebookPlugin: JupyterFrontEndPlugin<void> = {
  id: 'jupytereverywhere:notebook',
  autoStart: true,
  requires: [INotebookTracker],
  activate: (app: JupyterFrontEnd, tracker: INotebookTracker) => {
    const { commands, shell } = app;

    const params = new URLSearchParams(window.location.search);

    if (params.get('notebook')) {
      // TODO open notebook as view-only
    } else {
      // TODO: check if notebook already exists
      commands.execute('docmanager:new-untitled', { type: 'notebook' });
      commands.execute('docmanager:open', { path: 'Untitled.ipynb' });
    }

    shell.add(
      new SidebarIcon({
        label: 'Notebook',
        icon: EverywhereIcons.notebook,
        execute: () => {
          if (tracker.currentWidget) {
            shell.activateById(tracker.currentWidget.id);
          }
        }
      }),
      'left',
      { rank: 100 }
    );

    /**
     * Create a "Share" button
     */
    const shareButton = new ToolbarButton({
      label: 'Share',
      icon: EverywhereIcons.link,
      tooltip: 'Share this notebook',
      onClick: () => {
        void commands.execute(Commands.shareNotebookCommand);
      }
    });

    /**
     * Create the Download dropdown
     */
    const downloadDropdownButton = new DownloadDropdownButton(commands);

    tracker.widgetAdded.connect((_, notebookPanel) => {
      if (notebookPanel) {
        // Look for the right position to insert the buttons (after the run buttons)
        let insertIndex = 5;
        const toolbar = notebookPanel.toolbar;

        Array.from(toolbar.names()).forEach((name, index) => {
          if (name === 'run-all') {
            insertIndex = index + 1;
          }
        });

        // Add download dropdown button
        try {
          toolbar.insertItem(insertIndex, 'downloadDropdownButton', downloadDropdownButton);
          insertIndex++;
        } catch (error) {
          toolbar.addItem('downloadDropdownButton', downloadDropdownButton);
        }

        // Add the share button
        try {
          toolbar.insertItem(insertIndex, 'shareButton', shareButton);
        } catch (error) {
          // Fallback: add at the end
          toolbar.addItem('shareButton', shareButton);
        }
      }
    });
  }
};
