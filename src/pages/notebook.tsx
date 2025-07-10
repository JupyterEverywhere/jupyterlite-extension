import { JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { INotebookTracker } from '@jupyterlab/notebook';
import { INotebookContent } from '@jupyterlab/nbformat';
import { SidebarIcon } from '../ui-components/SidebarIcon';
import { EverywhereIcons } from '../icons';
import { ToolbarButton, IToolbarWidgetRegistry } from '@jupyterlab/apputils';
import { PageConfig } from '@jupyterlab/coreutils';
import { DownloadDropdownButton } from '../ui-components/DownloadDropdownButton';
import { Commands } from '../commands';
import { SharingService } from '../sharing-service';
import { VIEW_ONLY_NOTEBOOK_FACTORY, IViewOnlyNotebookTracker } from '../view-only';

export const notebookPlugin: JupyterFrontEndPlugin<void> = {
  id: 'jupytereverywhere:notebook',
  autoStart: true,
  requires: [INotebookTracker, IViewOnlyNotebookTracker, IToolbarWidgetRegistry],
  activate: (
    app: JupyterFrontEnd,
    tracker: INotebookTracker,
    readonlyTracker: IViewOnlyNotebookTracker,
    toolbarRegistry: IToolbarWidgetRegistry
  ) => {
    const { commands, shell, serviceManager } = app;
    const { contents } = serviceManager;

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

        const apiUrl =
          PageConfig.getOption('sharing_service_api_url') || 'http://localhost:8080/api/v1';
        const sharingService = new SharingService(apiUrl);

        console.log(`API URL: ${apiUrl}`);
        console.log('Retrieving notebook from API...');

        const notebookResponse = await sharingService.retrieve(id);
        console.log('API Response received:', notebookResponse);

        const { content }: { content: INotebookContent } = notebookResponse;

        // We make all cells read-only by setting editable: false.
        // This is still required with a custom widget factory as
        // it is not trivial to coerce the cells to respect the `readOnly`
        // property otherwise (Mike tried swapping `Notebook.ContentFactory`
        // and it does not work without further hacks).
        if (content.cells) {
          content.cells.forEach(cell => {
            cell.metadata = {
              ...cell.metadata,
              editable: false
            };
          });
        }

        const { id: responseId, readable_id, domain_id } = notebookResponse;
        content.metadata = {
          ...content.metadata,
          isSharedNotebook: true,
          sharedId: responseId,
          readableId: readable_id,
          domainId: domain_id
        };

        const filename = `Shared_${readable_id || responseId}.ipynb`;

        await contents.save(filename, {
          content,
          format: 'json',
          type: 'notebook',
          // Even though we have a custom view-only factory, we still
          // want to indicate that notebook is read-only to avoid
          // error on Ctrl + S and instead get a nice notification that
          // the notebook cannot be saved unless using save-as.
          writable: false
        });

        await commands.execute('docmanager:open', {
          path: filename,
          factory: VIEW_ONLY_NOTEBOOK_FACTORY
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
        if (readonlyTracker.currentWidget) {
          return shell.activateById(readonlyTracker.currentWidget.id);
        }
        if (tracker.currentWidget) {
          return shell.activateById(tracker.currentWidget.id);
        }
      }
    });
    shell.add(sidebarItem, 'left', { rank: 100 });

    app.shell.activateById(sidebarItem.id);
    app.restored.then(() => app.shell.activateById(sidebarItem.id));

    for (const toolbarName of ['Notebook', 'ViewOnlyNotebook']) {
      toolbarRegistry.addFactory(
        toolbarName,
        'createCopy',
        () =>
          new ToolbarButton({
            label: 'Create Copy',
            tooltip: 'Create an editable copy of this notebook',
            className: 'je-CreateCopyButton',
            onClick: () => {
              void commands.execute(Commands.createCopyNotebookCommand);
            }
          })
      );
      toolbarRegistry.addFactory(
        toolbarName,
        'downloadDropdown',
        () => new DownloadDropdownButton(commands)
      );

      toolbarRegistry.addFactory(
        toolbarName,
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
  }
};
