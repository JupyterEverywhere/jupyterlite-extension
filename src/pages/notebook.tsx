import { JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { INotebookTracker, INotebookWidgetFactory } from '@jupyterlab/notebook';
import { INotebookContent } from '@jupyterlab/nbformat';
import { SidebarIcon } from '../ui-components/SidebarIcon';
import { EverywhereIcons } from '../icons';
import { ToolbarButton, IToolbarWidgetRegistry } from '@jupyterlab/apputils';
import { PageConfig } from '@jupyterlab/coreutils';
import { DownloadDropdownButton } from '../ui-components/DownloadDropdownButton';
import { Commands } from '../commands';
import { SharingService } from '../sharing-service';
import { VIEW_ONLY_NOTEBOOK_FACTORY, IViewOnlyNotebookTracker } from '../view-only';
import { KernelSwitcherDropdownButton } from '../ui-components/KernelSwitcherDropdownButton';
import { KERNEL_URL_TO_NAME, KERNEL_DISPLAY_NAMES } from '../kernels';

/**
 * Maps the notebook content language to a kernel name. We currently
 * only support Python and R notebooks, so this function maps them
 * to 'python' and 'xr' respectively. If the language is not recognized,
 * it defaults to 'python' (Pyodide).
 * @param content - The notebook content to map the language to a kernel name.
 * @returns - The kernel name as a string, either 'python' for Python or 'xr' for R.
 */
function mapLanguageToKernel(content: INotebookContent): string {
  const rawLang =
    (content?.metadata?.kernelspec?.language as string | undefined)?.toLowerCase() ||
    (content?.metadata?.language_info?.name as string | undefined)?.toLowerCase() ||
    'python';

  if (rawLang === 'r') {
    return 'xr';
  }
  return 'python';
}

export const notebookPlugin: JupyterFrontEndPlugin<void> = {
  id: 'jupytereverywhere:notebook',
  autoStart: true,
  requires: [
    INotebookTracker,
    IViewOnlyNotebookTracker,
    IToolbarWidgetRegistry,
    INotebookWidgetFactory
  ],
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
    const uploadedNotebookId = params.get('uploaded-notebook');

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

        // Remove kernel param from URL, as we no longer need it on
        // a view-only notebook.
        const url = new URL(window.location.href);
        url.searchParams.delete('kernel');
        window.history.replaceState({}, '', url.toString());

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
        const params = new URLSearchParams(window.location.search);
        const desiredKernelParam = params.get('kernel') || 'python';
        const desiredKernel = KERNEL_URL_TO_NAME[desiredKernelParam] || 'python';

        await commands.execute('notebook:create-new', {
          kernelName: desiredKernel
        });

        console.log(`Created new notebook with kernel: ${desiredKernel}`);
      } catch (error) {
        console.error('Failed to create new notebook:', error);
      }
    };

    const openUploadedNotebook = async (id: string): Promise<void> => {
      try {
        const raw = localStorage.getItem(`uploaded-notebook:${id}`);
        // Should not happen
        if (!raw) {
          console.warn(`No uploaded notebook found for ID: ${id}`);
          await createNewNotebook();
          return;
        }

        const content = JSON.parse(raw) as INotebookContent;

        const kernelName = mapLanguageToKernel(content);
        content.metadata.kernelspec = {
          name: kernelName,
          display_name: KERNEL_DISPLAY_NAMES[kernelName] ?? kernelName
        };

        const filename = `${(content.metadata?.name as string) || `Uploaded_${id}`}.ipynb`;

        await contents.save(filename, {
          type: 'notebook',
          format: 'json',
          content
        });
        await commands.execute('docmanager:open', { path: filename });

        // Once we have the notebook in the editor, it is now safe to drop
        // the uploaded notebook ID from the URL and the temporary storage.
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.delete('uploaded-notebook');
        window.history.replaceState({}, '', currentUrl.toString());

        localStorage.removeItem(`uploaded-notebook:${id}`);
        console.log(`Opened uploaded notebook: ${filename}`);
      } catch (error) {
        console.error('Failed to open uploaded notebook:', error);
        await createNewNotebook();
      }
    };

    // If a notebook ID is provided in the URL (whether shared or uploaded),
    // load it; otherwise, create a new notebook
    if (notebookId) {
      void loadSharedNotebook(notebookId);
    } else if (uploadedNotebookId) {
      void openUploadedNotebook(uploadedNotebookId);
    } else {
      void createNewNotebook();
    }

    // Remove kernel URL param after notebook kernel is ready, as
    // we don't want it to linger and confuse users.
    tracker.widgetAdded.connect((_, panel) => {
      panel.sessionContext.ready.then(() => {
        const url = new URL(window.location.href);
        if (url.searchParams.has('kernel')) {
          url.searchParams.delete('kernel');
          window.history.replaceState({}, '', url.toString());
          console.log('Removed kernel param from URL after kernel init.');
        }
      });
    });

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
      toolbarRegistry.addFactory('Notebook', 'save', () => {
        return new ToolbarButton({
          label: '',
          icon: EverywhereIcons.save,
          tooltip: 'Save this notebook',
          onClick: () => {
            void app.commands.execute(Commands.saveAndShareNotebookCommand);
          }
        });
      });
      toolbarRegistry.addFactory(
        'Notebook',
        'jeKernelSwitcher',
        () => new KernelSwitcherDropdownButton(commands, tracker)
      );
    }
  }
};
