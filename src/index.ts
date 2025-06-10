import { ILabShell, JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { ReadonlyPartialJSONObject } from '@lumino/coreutils';
import { Dialog, showDialog, ReactWidget } from '@jupyterlab/apputils';
import { PageConfig } from '@jupyterlab/coreutils';
import { INotebookContent } from '@jupyterlab/nbformat';

import { SharingService } from './sharing-service';

import {
  IShareDialogData,
  ShareDialog,
  createSuccessDialog,
  createErrorDialog
} from './ui-components/share-dialog';

import { exportNotebookAsPDF } from './pdf';
import { files } from './pages/files';
import { Commands } from './commands';
import { competitions } from './pages/competitions';
import { notebookPlugin } from './pages/notebook';

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
  requires: [INotebookTracker],
  activate: (app: JupyterFrontEnd, tracker: INotebookTracker) => {
    const { commands, shell } = app;

    if ((shell as ILabShell).mode !== 'single-document') {
      // workaround issue with jupyterlite single doc mode
      commands.execute('application:set-mode', { mode: 'single-document' });
    }

    // Get API URL from configuration or use a default
    const apiUrl =
      PageConfig.getOption('sharing_service_api_url') || 'http://localhost:8080/api/v1';

    const sharingService = new SharingService(apiUrl);

    /**
     * 1. A "Download as IPyNB" command.
     */
    commands.addCommand(Commands.downloadNotebookCommand, {
      label: 'Download as IPyNB',
      execute: args => {
        // Execute the built-in download command
        return commands.execute('docmanager:download');
      }
    });

    /**
     * 2. A "Download as PDF" command.
     */
    commands.addCommand(Commands.downloadPDFCommand, {
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
    commands.addCommand(Commands.shareNotebookCommand, {
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
            const { notebookName, password } = result.value as IShareDialogData;

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
                shareResponse = await sharingService.share(notebookContent, password);
              } else if (notebookId) {
                shareResponse = await sharingService.update(notebookId, notebookContent, password);
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
                notebookContent.metadata.isPasswordProtected = true;

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
                  body: ReactWidget.create(createSuccessDialog(shareableLink, isNewShare, true)),
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
  }
};

export default [plugin, notebookPlugin, files, competitions];
