import { JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { INotebookTracker } from '@jupyterlab/notebook';
import { SidebarIcon } from '../ui-components/SidebarIcon';
import { EverywhereIcons } from '../icons';
import { ToolbarButton, IToolbarWidgetRegistry } from '@jupyterlab/apputils';
import { DownloadDropdownButton } from '../ui-components/DownloadDropdownButton';
import { Commands } from '../commands';
import { SharingService } from '../sharing-service';
import { INotebookContent } from '@jupyterlab/nbformat';

export const notebookPlugin: JupyterFrontEndPlugin<void> = {
  id: 'jupytereverywhere:notebook',
  autoStart: true,
  requires: [INotebookTracker, IToolbarWidgetRegistry],
  activate: (
    app: JupyterFrontEnd,
    tracker: INotebookTracker,
    toolbarRegistry: IToolbarWidgetRegistry
  ) => {
    const { commands, shell } = app;
    const contents = app.serviceManager.contents;

    const params = new URLSearchParams(window.location.search);
    let notebookId = params.get('notebook');

    if (notebookId?.endsWith('.ipynb')) {
      notebookId = notebookId.slice(0, -6);
    }

    /**
     * Load a shared notebook from the CKHub API
     */
    const loadSharedNotebook = async (id: string): Promise<void> => {
      try {
        console.log(`Loading shared notebook with ID: ${id}`);

        const apiUrl = 'http://localhost:8080/api/v1';
        const sharingService = new SharingService(apiUrl);

        console.log(`API URL: ${apiUrl}`);
        console.log('Retrieving notebook from API...');

        const notebookResponse = await sharingService.retrieve(id);
        console.log('API Response received:', notebookResponse); // debug

        const content: INotebookContent = notebookResponse.content;

        // We make all cells read-only by setting editable: false
        // by iterating over each cell in the notebook content.
        if (content.cells) {
          content.cells.forEach(cell => {
            cell.metadata = {
              ...cell.metadata,
              editable: false
            };
          });
        }

        content.metadata = {
          ...content.metadata,
          isSharedNotebook: true,
          sharedId: notebookResponse.id,
          readableId: notebookResponse.readable_id,
          domainId: notebookResponse.domain_id
        };

        // Generate a meaningful filename for the shared notebook
        const filename = `Shared_${notebookResponse.readable_id || notebookResponse.id}.ipynb`;

        await contents.save(filename, {
          content,
          format: 'json',
          type: 'notebook',
          writable: false
        });

        await commands.execute('docmanager:open', {
          path: filename,
          factory: 'Notebook'
        });

        console.log(`Successfully loaded shared notebook: ${filename}`);
      } catch (error) {
        console.error('Failed to load shared notebook:', error);

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : undefined;

        console.error('Error details:', {
          message: errorMessage,
          stack: errorStack,
          notebookId: id,
          errorType: typeof error,
          errorConstructor: error?.constructor?.name
        });

        alert(`Failed to load shared notebook "${id}": ${errorMessage}`);
        await createNewNotebook();
      }
    };

    /**
     * Create a new blank notebook
     */
    const createNewNotebook = async (): Promise<void> => {
      try {
        const result = await commands.execute('docmanager:new-untitled', { type: 'notebook' });
        if (result) {
          await commands.execute('docmanager:open', { path: 'Untitled.ipynb' });
        }
      } catch (error) {
        console.error('Failed to create new notebook:', error);
      }
    };

    // If a notebook ID is provided in the URL, load it; otherwise,
    // create a new notebook
    if (notebookId) {
      void loadSharedNotebook(notebookId);
    } else {
      void createNewNotebook();
    }

    const sidebarItem = new SidebarIcon({
      label: 'Notebook',
      icon: EverywhereIcons.notebook,
      execute: () => {
        if (tracker.currentWidget) {
          shell.activateById(tracker.currentWidget.id);
        }
      }
    });
    shell.add(sidebarItem, 'left', { rank: 100 });

    app.shell.activateById(sidebarItem.id);
    app.restored.then(() => app.shell.activateById(sidebarItem.id));

    toolbarRegistry.addFactory(
      'Notebook',
      'downloadDropdown',
      () => new DownloadDropdownButton(commands)
    );

    toolbarRegistry.addFactory(
      'Notebook',
      'share',
      () =>
        new ToolbarButton({
          label: 'Share',
          icon: EverywhereIcons.link,
          tooltip: 'Share this notebook',
          onClick: () => {
            void commands.execute(Commands.shareNotebookCommand);
          }
        })
    );
  }
};
