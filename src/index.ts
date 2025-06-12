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

function generatePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  let password = '';
  for (let i = 0; i < array.length; i++) {
    password += chars.charAt(array[i] % chars.length);
  }
  return password;
}

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

    async function handleNotebookSave(
      notebookPanel: NotebookPanel,
      isManualShare: boolean = false
    ) {
      const notebookContent = notebookPanel.context.model.toJSON() as INotebookContent;

      // Check if notebook has already been shared
      const isAlreadyShared =
        notebookContent.metadata &&
        typeof notebookContent.metadata === 'object' &&
        'sharedId' in notebookContent.metadata &&
        'sharedPassword' in notebookContent.metadata;

      if (isAlreadyShared && !isManualShare) {
        try {
          const sharedId = notebookContent.metadata.sharedId as string;
          const sharedPassword = notebookContent.metadata.sharedPassword as string;

          console.log('Updating notebook:', sharedId); // debug

          await sharingService.authenticate();
          await sharingService.update(sharedId, notebookContent, sharedPassword);

          console.log('Notebook automatically synced to CKHub');
        } catch (error) {
          console.warn('Failed to sync notebook to CKHub:', error); // debug
          await showDialog({
            // title: 'Sync failed',
            body: ReactWidget.create(createErrorDialog(error)),
            buttons: [Dialog.okButton()]
          });
        }
        return;
      }

      if (!isAlreadyShared && !isManualShare) {
        // First save - create share and show password
        const password = generatePassword();
        const defaultName = `Notebook_${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${new Date().getDate().toString().padStart(2, '0')}`;

        try {
          await sharingService.authenticate();
          const shareResponse = await sharingService.share(notebookContent, password);

          if (shareResponse && shareResponse.notebook) {
            // Update metadata
            if (!notebookContent.metadata) {
              notebookContent.metadata = {};
            }

            notebookContent.metadata.sharedId = shareResponse.notebook.id;
            notebookContent.metadata.readableId = shareResponse.notebook.readable_id;
            notebookContent.metadata.sharedName = defaultName;
            notebookContent.metadata.isPasswordProtected = true;
            notebookContent.metadata.sharedPassword = password;
            notebookContent.metadata.lastShared = new Date().toISOString();

            notebookPanel.context.model.fromJSON(notebookContent);
            await notebookPanel.context.save();

            // Show success dialog with password (first time only)
            const shareableLink = sharingService
              .makeRetrieveURL(shareResponse.notebook.readable_id || shareResponse.notebook.id)
              .toString();

            const dialogResult = await showDialog({
              // title: 'Notebook shared',
              body: ReactWidget.create(createSuccessDialog(shareableLink, true, true, password)),
              buttons: [
                Dialog.okButton({ label: 'Done' }),
                Dialog.cancelButton({ label: 'Copy Link' })
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
          console.error('Failed to share notebook:', error);
          await showDialog({
            title: 'Error Sharing Notebook',
            body: ReactWidget.create(createErrorDialog(error)),
            buttons: [Dialog.okButton()]
          });
        }
      }

      if (isManualShare) {
        // Manual share button pressed - show link only (no password)
        const readableId = notebookContent.metadata.readableId as string;
        const sharedId = notebookContent.metadata.sharedId as string;
        const shareableLink = sharingService.makeRetrieveURL(readableId || sharedId).toString();

        const dialogResult = await showDialog({
          // title: 'Here is the shareable link to your notebook:',
          body: ReactWidget.create(createSuccessDialog(shareableLink, false, true)),
          buttons: [
            Dialog.okButton({ label: 'Copy Link!' }),
            Dialog.cancelButton({ label: 'Close' })
          ]
        });

        if (dialogResult.button.label === 'Copy Link!') {
          try {
            await navigator.clipboard.writeText(shareableLink);
          } catch (err) {
            console.error('Failed to copy link:', err);
          }
        }
      }
    }

    /**
     * We override the default save command to use CKHub instead of Jupyter's saving.
     */
    tracker.widgetAdded.connect((sender, widget) => {
      widget.context.saveState.connect(async (sender, saveState) => {
        // Only trigger when save is completed (not dirty and not saving)
        if (saveState === 'completed') {
          await handleNotebookSave(widget, false);
        }
      });
    });

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

          if (isNewShare) {
            const result = await showDialog({
              title: 'Share Notebook',
              body: new ShareDialog(),
              buttons: [Dialog.cancelButton(), Dialog.okButton()]
            });

            if (result.button.accept) {
              const { notebookName } = result.value as IShareDialogData;
              const password = generatePassword();

              try {
                await sharingService.authenticate();
                const shareResponse = await sharingService.share(notebookContent, password);

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
                  notebookContent.metadata.sharedPassword = password;

                  notebookPanel.context.model.fromJSON(notebookContent);
                  await notebookPanel.context.save();
                }

                let shareableLink = '';
                if (shareResponse && shareResponse.notebook) {
                  const id = shareResponse.notebook.readable_id || shareResponse.notebook.id;
                  shareableLink = sharingService.makeRetrieveURL(id).toString();
                }

                if (shareableLink) {
                  const dialogResult = await showDialog({
                    // title: 'Notebook shared',
                    body: ReactWidget.create(
                      createSuccessDialog(shareableLink, true, true, password)
                    ),
                    buttons: [
                      Dialog.okButton({ label: 'Done' }),
                      Dialog.cancelButton({ label: 'Copy Link' })
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
          } else {
            // Already shared; just show the link (no password)
            // as we don't want to expose the password again.
            await handleNotebookSave(notebookPanel, true);
          }
        } catch (error) {
          console.error('Error in share command:', error);
        }
      }
    });
  }
};

export default [plugin, notebookPlugin, files, competitions];
