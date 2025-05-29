import { JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { ReadonlyPartialJSONObject } from '@lumino/coreutils';
import { ITranslator } from '@jupyterlab/translation';
import { Dialog, showDialog, ToolbarButton, ReactWidget } from '@jupyterlab/apputils';
import { PageConfig } from '@jupyterlab/coreutils';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { linkIcon } from '@jupyterlab/ui-components';
import { INotebookContent } from '@jupyterlab/nbformat';

import { SharingService } from './sharing-service';
import { DownloadDropdownButton } from './ui-components';
import {
  IShareDialogData,
  ShareDialog,
  createSuccessDialog,
  createErrorDialog
} from './share-dialog';

import { exportNotebookAsPDF } from './pdf';

/**
 * Get the current notebook panel
 */
function getCurrentNotebook(
  tracker: INotebookTracker,
  shell: JupyterFrontEnd.IShell,
  args: ReadonlyPartialJSONObject = {}
): NotebookPanel | null {
  const widget = tracker.currentWidget;
  const activate = args['activate'] !== false;

  if (activate && widget) {
    shell.activateById(widget.id);
  }

  return widget;
}

/**
 * JUPYTEREVERYWHERE EXTENSION
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupytereverywhere:plugin',
  description: 'A Jupyter extension for k12 education',
  autoStart: true,
  requires: [INotebookTracker, ITranslator, IDocumentManager],
  activate: (
    app: JupyterFrontEnd,
    tracker: INotebookTracker,
    translator: ITranslator,
    docManager: IDocumentManager
  ) => {
    // Get API URL from configuration or use a default
    const apiUrl =
      PageConfig.getOption('sharing_service_api_url') || 'http://localhost:8080/api/v1';

    const sharingService = new SharingService(apiUrl);

    const { commands, shell } = app;

    /**
     * 1. A "Download as IPyNB" command.
     */
    const downloadNotebookCommand = 'jupytereverywhere:download-notebook';
    commands.addCommand(downloadNotebookCommand, {
      label: 'Download as IPyNB',
      execute: args => {
        // Execute the built-in download command
        return commands.execute('docmanager:download');
      }
    });

    /**
     * 2. A "Download as PDF" command.
     */
    const downloadPDFCommand = 'jupytereverywhere:download-pdf';
    commands.addCommand(downloadPDFCommand, {
      label: 'Download as PDF',
      execute: async args => {
        const current = getCurrentNotebook(tracker, shell, args);
        if (!current) {
          console.warn('No active notebook to download as PDF');
          return;
        }

        try {
          await exportNotebookAsPDF(current);
        } catch (error) {
          console.error('Failed to export notebook as PDF:', error);
          await showDialog({
            title: 'Error exporting PDF',
            body: ReactWidget.create(createErrorDialog(error)),
            buttons: [Dialog.okButton()]
          });
        }
      }
    });

    /**
     * Add custom Share notebook command
     */
    const shareNotebookCommand = 'jupytereverywhere:share-notebook';
    commands.addCommand(shareNotebookCommand, {
      label: 'Share Notebook',
      execute: async () => {
        try {
          const notebookPanel = tracker.currentWidget;
          if (!notebookPanel) {
            return;
          }

          // Save the notebook before we share it.
          await notebookPanel.context.save();

          const notebookContent = notebookPanel.context.model.toJSON() as INotebookContent;

          // Check if notebook has already been shared; access metadata using notebook content
          let notebookId: string | undefined;
          if (
            notebookContent.metadata &&
            typeof notebookContent.metadata === 'object' &&
            'sharedId' in notebookContent.metadata
          ) {
            notebookId = notebookContent.metadata.sharedId as string;
          }

          const isNewShare = !notebookId;

          const result = await showDialog({
            title: isNewShare ? 'Share Notebook' : 'Update Shared Notebook',
            body: new ShareDialog(),
            buttons: [Dialog.cancelButton(), Dialog.okButton()]
          });

          if (result.button.accept) {
            const shareDialogData = result.value as IShareDialogData;
            const { notebookName, isViewOnly, password } = shareDialogData;

            try {
              // Show loading indicator
              // TODO: this doesn't show up in the dialog properly, we could
              // even remove it as loading doesn't take long at all
              const loadingIndicator = document.createElement('div');
              loadingIndicator.textContent = 'Sharing notebook...';
              loadingIndicator.style.position = 'fixed';
              loadingIndicator.style.bottom = '20px';
              loadingIndicator.style.right = '20px';
              loadingIndicator.style.padding = '10px';
              loadingIndicator.style.backgroundColor = '#f0f0f0';
              loadingIndicator.style.borderRadius = '5px';
              loadingIndicator.style.zIndex = '1000';
              document.body.appendChild(loadingIndicator);

              await sharingService.authenticate();

              let shareResponse;
              if (isNewShare) {
                shareResponse = await sharingService.share(
                  notebookContent,
                  isViewOnly ? password : undefined
                );
              } else if (notebookId) {
                shareResponse = await sharingService.update(
                  notebookId,
                  notebookContent,
                  isViewOnly ? password : undefined
                );
              }

              if (shareResponse && shareResponse.notebook) {
                // We need to update the metadata in the notebookContent first
                // to do this, and we need to ensure that the metadata object exists
                if (!notebookContent.metadata) {
                  notebookContent.metadata = {};
                }

                notebookContent.metadata.sharedId = shareResponse.notebook.id;
                notebookContent.metadata.readableId = shareResponse.notebook.readable_id;
                notebookContent.metadata.sharedName = notebookName;
                notebookContent.metadata.isPasswordProtected = isViewOnly;

                notebookPanel.context.model.fromJSON(notebookContent);
              }

              let shareableLink = '';
              if (shareResponse && shareResponse.notebook) {
                const id = shareResponse.notebook.readable_id || shareResponse.notebook.id;
                shareableLink = sharingService.makeRetrieveURL(id).toString();
              }

              // Remove loading indicator
              document.body.removeChild(loadingIndicator);

              if (shareableLink) {
                const dialogResult = await showDialog({
                  title: isNewShare
                    ? 'Notebook Shared Successfully'
                    : 'Notebook Updated Successfully',
                  body: ReactWidget.create(
                    createSuccessDialog(shareableLink, isNewShare, isViewOnly)
                  ),
                  buttons: [
                    Dialog.okButton({ label: 'Copy Link' }),
                    Dialog.cancelButton({ label: 'Close' })
                  ]
                });

                if (dialogResult.button.label === 'Copy Link') {
                  try {
                    await navigator.clipboard.writeText(shareableLink);
                  } catch (err) {
                    console.error('Failed to copy link:', err);
                  }
                }
              }
            } catch (error) {
              await showDialog({
                title: 'Error',
                body: ReactWidget.create(createErrorDialog(error)),
                buttons: [Dialog.okButton()]
              });
            }
          }
        } catch (error) {
          console.error('Error in share command:', error);
        }
      }
    });

    /**
     * Create a "Share" button
     */
    const shareButton = new ToolbarButton({
      label: 'Share',
      icon: linkIcon,
      tooltip: 'Share this notebook',
      onClick: () => {
        void commands.execute(shareNotebookCommand);
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

export default plugin;
