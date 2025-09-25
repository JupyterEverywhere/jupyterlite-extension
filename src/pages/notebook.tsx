import { JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { ILiteRouter } from '@jupyterlite/application';
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
  optional: [ILiteRouter],
  activate: (
    app: JupyterFrontEnd,
    tracker: INotebookTracker,
    readonlyTracker: IViewOnlyNotebookTracker,
    toolbarRegistry: IToolbarWidgetRegistry,
    router?: ILiteRouter | null
  ) => {
    const { commands, shell, serviceManager } = app;
    const { contents } = serviceManager;

    const params = new URLSearchParams(window.location.search);

    // Are we landing on the Files tab directly? In this case, we won't
    // auto-create a new notebook or activate the notebook sidebar.
    const nowUrl = new URL(window.location.href);
    const onFilesPath = /\/lab\/files(?:\/|$)/.test(nowUrl.pathname);
    const onFilesTab = nowUrl.searchParams.get('tab') === 'files';
    const onFilesIntent = onFilesPath || onFilesTab;

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
    } else if (!onFilesIntent) {
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
      pathName: `${(router?.base || '').replace(/\/$/, '')}/lab/index.html`,
      execute: () => {
        if (readonlyTracker.currentWidget) {
          const id = readonlyTracker.currentWidget.id;
          shell.activateById(id);
          return SidebarIcon.delegateNavigation;
        }
        if (tracker.currentWidget) {
          const id = tracker.currentWidget.id;
          shell.activateById(id);
          return SidebarIcon.delegateNavigation;
        }

        // If we don't have a notebook yet (likely we started on /lab/files/) -> create one now.
        void (async () => {
          await app.commands.execute('notebook:create-new', { kernelName: 'python' });
          if (tracker.currentWidget) {
            shell.activateById(tracker.currentWidget.id);
          }
        })();
        return SidebarIcon.delegateNavigation;
      }
    });
    shell.add(sidebarItem, 'left', { rank: 100 });

    if (!onFilesIntent) {
      app.shell.activateById(sidebarItem.id);
      app.restored.then(() => app.shell.activateById(sidebarItem.id));
    }

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

    // Canonicalise the URL if we are directly at /lab/.
    void app.restored.then(() => {
      const url = new URL(window.location.href);
      if (/\/lab\/$/.test(url.pathname)) {
        url.pathname = url.pathname.replace(/\/lab\/$/, '/lab/index.html');
        window.history.replaceState({}, '', url.toString());
      }

      const after = new URL(window.location.href);
      if (after.searchParams.get('tab') === 'notebook') {
        const id = document.querySelector('.jp-NotebookPanel')?.id;
        if (id) {
          app.shell.activateById(id);
          after.searchParams.delete('tab');
          const base = (router?.base || '').replace(/\/$/, '');
          const canonical = new URL(`${base}/lab/index.html`, window.location.origin);
          canonical.hash = after.hash;
          // Keep any other non-tab params off; Notebook page doesn't need them
          if (
            after.pathname + after.search + after.hash !==
            canonical.pathname + canonical.search + canonical.hash
          ) {
            window.history.replaceState(null, 'Notebook', canonical.toString());
          }
        }
      }
    });
  }
};
