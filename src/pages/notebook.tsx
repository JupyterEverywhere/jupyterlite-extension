import { JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
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

        // Detect kernel from kernelspec,
        const kernelspec = (content.metadata?.kernelspec || {}) as any;
        let kernelName: string | undefined;

        if (typeof kernelspec?.name === 'string') {
          kernelName = kernelspec.name;
          console.log(`Detected kernel from kernelspec: ${kernelName}`);
        } else {
          console.log('No kernelspec found in shared notebook.');
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

        // Remove kernel param from URL, as we no longer need it.
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
        const desiredKernel = params.get('kernel') || 'python';

        const result = await commands.execute('docmanager:new-untitled', {
          type: 'notebook'
        });

        if (result) {
          await commands.execute('docmanager:open', {
            path: result.path
          });

          const panel = tracker.currentWidget;

          // Store the kernel preference in the notebook's metadata, as
          // we will use it to set the kernel when the notebook is opened
          // and grab the kernel from the URL if available. This serves
          // as a hint to get the correct kernel, as we can't distinguish
          // based on the file extension alone.
          if (panel?.context.model) {
            panel.context.model.setMetadata('kernelspec', {
              name: desiredKernel,
              display_name: desiredKernel
            });

            panel.context.sessionContext.kernelPreference = {
              name: desiredKernel
            };

            await panel.context.sessionContext.initialize();

            const url = new URL(window.location.href);
            url.searchParams.set('kernel', desiredKernel);
            window.history.replaceState({}, '', url.toString());
          } else {
            console.warn('New notebook panel not available or model is missing.');
          }
        }
      } catch (error) {
        console.error('Failed to create new notebook:', error);
      }
    };

    app.commands.commandExecuted.connect(async (sender, args) => {
      if (args.id === 'docmanager:open') {
        const panel = tracker.currentWidget;

        if (panel instanceof NotebookPanel && panel?.context.model) {
          let desiredKernel: string | undefined;

          const params = new URLSearchParams(window.location.search);
          desiredKernel = params.get('kernel') || undefined;

          if (!desiredKernel) {
            const kernelspec = panel.context.model.getMetadata('kernelspec') as
              | { name?: string }
              | undefined;
            desiredKernel = kernelspec?.name;
          }

          if (desiredKernel) {
            console.log(`Setting kernel preference: ${desiredKernel}`);
            panel.context.sessionContext.kernelPreference = {
              name: desiredKernel
            };

            await panel.context.sessionContext.initialize();

            const url = new URL(window.location.href);
            url.searchParams.delete('kernel');
            url.searchParams.set('kernel', desiredKernel);
            window.history.replaceState({}, '', url.toString());
          } else {
            // Maybe better error handling here...
            console.log(
              'No kernel info found, kernel selection dialog will appear. This is a bug.'
            );
          }
        }
      }
    });

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
      toolbarRegistry.addFactory(
        'Notebook',
        'jeKernelSwitcher',
        () => new KernelSwitcherDropdownButton(commands, tracker)
      );
    }
  }
};
