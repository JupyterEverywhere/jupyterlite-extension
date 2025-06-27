import { JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { INotebookTracker } from '@jupyterlab/notebook';
import { SidebarIcon } from '../ui-components/SidebarIcon';
import { EverywhereIcons } from '../icons';
import { ToolbarButton, IToolbarWidgetRegistry } from '@jupyterlab/apputils';
import { DownloadDropdownButton } from '../ui-components/DownloadDropdownButton';
import { Commands } from '../commands';
import { SharingService } from '../sharing-service';
import { INotebookContent } from '@jupyterlab/nbformat';
import { Widget } from '@lumino/widgets';
import { IDisposable, DisposableDelegate } from '@lumino/disposable';

/**
 * Creates a "View Only" header widget for read-only notebooks.
 * @returns A Widget containing the "View Only" message.
 */
function createViewOnlyHeader(): Widget {
  const widget = new Widget();
  widget.addClass('je-ViewOnlyHeader');
  const contentNode = document.createElement('div');
  contentNode.className = 'je-ViewOnlyHeader-content';
  contentNode.textContent = 'View Only';

  widget.node.appendChild(contentNode);

  return widget;
}

/**
 * Checks if a notebook is read-only/shared based on its metadata.
 * @param notebookPanel - The notebook panel to check
 * @returns true if the notebook is read-only/shared, false otherwise
 */
// TODO: better typing for notebookPanel
function isReadOnlyNotebook(notebookPanel: any): boolean {
  try {
    const { context } = notebookPanel;
    if (!context?.model) {
      return false;
    }

    const { model } = context;
    let metadata = null;

    if (model.metadata && typeof model.metadata.get === 'function') {
      const { metadata: modelMetadata } = model;
      metadata = {
        isSharedNotebook: modelMetadata.get('isSharedNotebook'),
        sharedId: modelMetadata.get('sharedId'),
        readableId: modelMetadata.get('readableId')
      };
    } else if (model.metadata) {
      ({ metadata } = model);
    } else if (model.toJSON && model.toJSON().metadata) {
      const { metadata: jsonMetadata } = model.toJSON();
      metadata = jsonMetadata;
    }

    console.log('Notebook metadata:', metadata);

    return metadata?.isSharedNotebook === true;
  } catch (error) {
    console.warn('Error checking notebook read-only status:', error);
    return false;
  }
}

/**
 * Hides the "notebook is read-only" indicator from the toolbar/
 * @param notebookPanel - The notebook panel to remove the indicator from
 */
// TODO: better typing for notebookPanel
function hideReadOnlyIndicator(notebookPanel: any): void {
  try {
    const { toolbar } = notebookPanel;
    if (toolbar?.layout?.widgets) {
      const widgets = Array.from(toolbar.layout.widgets) as Widget[];
      for (const widget of widgets) {
        const { node } = widget;
        if (
          node &&
          typeof node.getAttribute === 'function' &&
          node.getAttribute('data-jp-item-name') === 'read-only-indicator'
        ) {
          if (typeof widget.hide === 'function') {
            widget.hide();
            return;
          }
        }
      }
    }
  } catch (error) {
    console.warn('Error hiding read-only indicator:', error);
  }
}

/**
//  * TODO find a better way to do this
 * Applies border-radius styles for the "View Only" header in accordance with the notebook area.
 * @param notebookPanel - The notebook panel to style
 * @param headerWidget - The View Only header widget
 */
function applySeamlessHeaderStyling(notebookPanel: any, headerWidget: Widget): void {
  try {
    const { node } = notebookPanel;
    const mainAreaWidget = node.querySelector('.jp-MainAreaWidget');

    if (mainAreaWidget) {
      const { style } = mainAreaWidget;
      Object.assign(style, {
        borderRadius: '0',
        borderTopLeftRadius: '0',
        borderTopRightRadius: '0',
        borderBottomLeftRadius: '0',
        borderBottomRightRadius: '0'
      });
    }

    if (headerWidget.node) {
      const { style } = headerWidget.node;
      Object.assign(style, {
        background: '#412c88',
        backgroundColor: '#412c88',
        borderRadius: '0px',
        borderBottomLeftRadius: '0px',
        borderBottomRightRadius: '0px',
        borderTopLeftRadius: '12px',
        borderTopRightRadius: '12px'
      });

      style.setProperty('border-bottom-left-radius', '0px', 'important');
      style.setProperty('border-bottom-right-radius', '0px', 'important');
      style.setProperty('border-top-left-radius', '12px', 'important');
      style.setProperty('border-top-right-radius', '12px', 'important');
      style.setProperty('background-color', '#412c88', 'important');
    }

    const contentHeader = node.querySelector('.jp-MainAreaWidget-contentHeader');
    if (contentHeader) {
      const { style } = contentHeader;
      Object.assign(style, {
        background: 'transparent',
        backgroundColor: 'transparent',
        padding: '0',
        margin: '0',
        borderRadius: '0px',
        borderTopLeftRadius: '0px',
        borderTopRightRadius: '0px',
        borderBottomLeftRadius: '0px',
        borderBottomRightRadius: '0px'
      });
    }

    const possibleWhiteContainers = [
      '.jp-MainAreaWidget-contentHeader > *',
      '.lm-BoxPanel-child',
      '.lm-Widget'
    ];

    possibleWhiteContainers.forEach(selector => {
      const containers = node.querySelectorAll(selector);
      containers.forEach((container: HTMLElement) => {
        if (container?.contains?.(headerWidget.node)) {
          const { style } = container;
          Object.assign(style, {
            borderRadius: '0px',
            borderBottomLeftRadius: '0px',
            borderBottomRightRadius: '0px',
            background: 'transparent',
            backgroundColor: 'transparent'
          });
        }
      });
    });

    setTimeout(() => {
      const contentSelectors = [
        '.jp-MainAreaWidget > :last-child',
        '.jp-MainAreaWidget > .lm-Widget:last-child',
        '.jp-NotebookPanel-notebook'
      ];

      for (const selector of contentSelectors) {
        const contentElements = node.querySelectorAll(selector);
        contentElements.forEach((element: HTMLElement) => {
          if (
            element?.style &&
            !element.classList.contains('jp-Toolbar') &&
            !element.classList.contains('jp-MainAreaWidget-contentHeader')
          ) {
            const { style } = element;
            Object.assign(style, {
              borderRadius: '0px 0px 12px 12px',
              borderTopLeftRadius: '0px',
              borderTopRightRadius: '0px',
              borderBottomLeftRadius: '12px',
              borderBottomRightRadius: '12px'
            });
          }
        });
      }

      if (headerWidget.node) {
        const { style } = headerWidget.node;
        Object.assign(style, {
          background: '#412c88',
          backgroundColor: '#412c88',
          borderRadius: '0px',
          borderBottomLeftRadius: '0px',
          borderBottomRightRadius: '0px',
          borderTopLeftRadius: '12px',
          borderTopRightRadius: '12px'
        });

        style.setProperty('border-bottom-left-radius', '0px', 'important');
        style.setProperty('border-bottom-right-radius', '0px', 'important');
        style.setProperty('border-top-left-radius', '12px', 'important');
        style.setProperty('border-top-right-radius', '12px', 'important');
        style.setProperty('background-color', '#412c88', 'important');

        console.log('Re-applied aggressive header styling for persistence');
      }
    }, 50);
  } catch (error) {
    console.warn('Error applying seamless header styling:', error);
  }
}

/**
 * Adds a "View Only" header to a read-only notebook panel.
 * @param notebookPanel - The notebook panel to add the header to
 * @returns A disposable that can be used to remove the header
 */
function addViewOnlyHeaderToNotebook(notebookPanel: any): IDisposable | null {
  try {
    if (!isReadOnlyNotebook(notebookPanel)) {
      console.log('Notebook is not read-only, skipping View Only header');
      return null;
    }

    console.log('Adding View Only header to read-only notebook');

    const headerWidget = createViewOnlyHeader();
    const { contentHeader, node } = notebookPanel;

    if (!contentHeader) {
      console.error('NotebookPanel.contentHeader is not available');
      return null;
    }

    console.log('ContentHeader available, inserting widget...');

    node.classList.add('je-shared-notebook');
    contentHeader.insertWidget(0, headerWidget);

    if (contentHeader.node) {
      const { style } = contentHeader.node;
      Object.assign(style, {
        display: 'flex',
        flexDirection: 'column',
        minHeight: 'auto'
      });
    }

    setTimeout(() => {
      hideReadOnlyIndicator(notebookPanel);
    }, 100);

    applySeamlessHeaderStyling(notebookPanel, headerWidget);

    console.log('View Only header added successfully');

    return new DisposableDelegate(() => {
      console.log('Disposing View Only header');
      node.classList.remove('je-shared-notebook');
      if (!headerWidget.isDisposed) {
        headerWidget.dispose();
      }
    });
  } catch (error) {
    console.error('Error adding View Only header:', error);
    return null;
  }
}

export const notebookPlugin: JupyterFrontEndPlugin<void> = {
  id: 'jupytereverywhere:notebook',
  autoStart: true,
  requires: [INotebookTracker, IToolbarWidgetRegistry],
  activate: (
    app: JupyterFrontEnd,
    tracker: INotebookTracker,
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

        const apiUrl = 'http://localhost:8080/api/v1';
        const sharingService = new SharingService(apiUrl);

        console.log(`API URL: ${apiUrl}`);
        console.log('Retrieving notebook from API...');

        const notebookResponse = await sharingService.retrieve(id);
        console.log('API Response received:', notebookResponse);

        const { content }: { content: INotebookContent } = notebookResponse;

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

    /**
     * Hook into notebook widgets to add a "View Only" header for read-only notebooks.
     */
    tracker.widgetAdded.connect((sender, notebookPanel) => {
      console.log('Notebook widget added, setting up View Only header check...');

      notebookPanel.revealed
        .then(() => {
          console.log('Notebook revealed, waiting for metadata to load...');

          setTimeout(() => {
            console.log('Checking if notebook is read-only...');
            const disposable = addViewOnlyHeaderToNotebook(notebookPanel);
            if (disposable) {
              notebookPanel.disposed.connect(() => {
                disposable.dispose();
              });
            }

            setTimeout(() => {
              if (isReadOnlyNotebook(notebookPanel)) {
                hideReadOnlyIndicator(notebookPanel);

                const { contentHeader } = notebookPanel;
                const headerWidget = contentHeader?.node?.querySelector('.je-ViewOnlyHeader');

                if (headerWidget) {
                  const headerElement = headerWidget as HTMLElement;
                  const { style } = headerElement;

                  Object.assign(style, {
                    background: '#412c88',
                    backgroundColor: '#412c88',
                    borderRadius: '0px',
                    borderBottomLeftRadius: '0px',
                    borderBottomRightRadius: '0px',
                    borderTopLeftRadius: '12px',
                    borderTopRightRadius: '12px'
                  });

                  style.setProperty('border-bottom-left-radius', '0px', 'important');
                  style.setProperty('border-bottom-right-radius', '0px', 'important');
                  style.setProperty('border-top-left-radius', '12px', 'important');
                  style.setProperty('border-top-right-radius', '12px', 'important');
                  style.setProperty('background-color', '#412c88', 'important');

                  if (contentHeader?.node) {
                    const { style: headerStyle } = contentHeader.node;
                    Object.assign(headerStyle, {
                      borderRadius: '0px',
                      borderBottomLeftRadius: '0px',
                      borderBottomRightRadius: '0px',
                      background: 'transparent',
                      backgroundColor: 'transparent'
                    });

                    headerStyle.setProperty('border-radius', '0px', 'important');
                    headerStyle.setProperty('background-color', 'transparent', 'important');
                    console.log('Fixed white container in final reapplication');
                  }

                  console.log('Re-applied MOST aggressive header styling');
                  applySeamlessHeaderStyling(notebookPanel, { node: headerWidget } as Widget);
                }
              }
            }, 200);
          }, 500);
        })
        .catch(error => {
          console.warn('Error waiting for notebook to be revealed:', error);
        });
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
