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
    const contents = app.serviceManager.contents;

    const params = new URLSearchParams(window.location.search);
    const notebookId = params.get('notebook');

    if (notebookId) {
      // TODO replace with API call (and iteration over cells to set `editable: false`)
      const content = {
        cells: [
          {
            cell_type: 'code',
            execution_count: null,
            id: '55eb9a2d-401d-4abd-b0eb-373ded5b408d',
            metadata: {
              // This makes cell non-editable
              editable: false
            },
            outputs: [],
            source: [`# This is notebook '${notebookId}'`]
          }
        ],
        metadata: {
          kernelspec: {
            display_name: 'Python 3 (ipykernel)',
            language: 'python',
            name: 'python3'
          },
          language_info: {
            codemirror_mode: {
              name: 'ipython',
              version: 3
            },
            file_extension: '.py',
            mimetype: 'text/x-python',
            name: 'python',
            nbconvert_exporter: 'python',
            pygments_lexer: 'ipython3'
          }
        },
        nbformat: 4,
        nbformat_minor: 5
      };
      contents
        .save('Untitled.ipynb', {
          content,
          format: 'json',
          type: 'notebook',
          writable: false
        })
        .then(() => commands.execute('docmanager:open', { path: 'Untitled.ipynb' }));
    } else {
      commands.execute('docmanager:new-untitled', { type: 'notebook' }).then(() => {
        commands.execute('docmanager:open', { path: 'Untitled.ipynb' });
      });
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
