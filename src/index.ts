import { ILabShell, JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { ReadonlyPartialJSONObject } from '@lumino/coreutils';
import { Dialog, showDialog, ReactWidget } from '@jupyterlab/apputils';
import { PageConfig } from '@jupyterlab/coreutils';
import { INotebookContent } from '@jupyterlab/nbformat';

import { customSidebar } from './sidebar';
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
        'sharedId' in notebookContent.metadata;

      if (isAlreadyShared && !isManualShare) {
        try {
          const sharedId = notebookContent.metadata.sharedId as string;
          console.log('Updating notebook:', sharedId);

          await sharingService.update(sharedId, notebookContent);

          console.log('Notebook automatically synced to CKHub');
        } catch (error) {
          console.warn('Failed to sync notebook to CKHub:', error);
          await showDialog({
            title: 'Sync Failed',
            body: ReactWidget.create(createErrorDialog(error)),
            buttons: [Dialog.okButton()]
          });
        }
        return;
      }

      if (!isAlreadyShared && !isManualShare) {
        // First save/share; displays a shareable link and shows a password in a dialog
        sharingService.password = generatePassword();
        const defaultName = `Notebook_${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${new Date().getDate().toString().padStart(2, '0')}`;

        try {
          const shareResponse = await sharingService.share(
            notebookContent,
            sharingService.password
          );

          if (shareResponse && shareResponse.notebook) {
            notebookContent.metadata = {
              ...notebookContent.metadata,
              sharedId: shareResponse.notebook.id,
              readableId: shareResponse.notebook.readable_id,
              sharedName: defaultName,
              isPasswordProtected: true,
              lastShared: new Date().toISOString()
            };

            notebookPanel.context.model.fromJSON(notebookContent);
            await notebookPanel.context.save();
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
        // Manual share button pressed - show link and password
        const readableId = notebookContent.metadata.readableId as string;
        const sharedId = notebookContent.metadata.sharedId as string;
        const shareableLink = sharingService.makeRetrieveURL(readableId || sharedId).toString();

        const dialogResult = await showDialog({
          title: '',
          body: ReactWidget.create(createSuccessDialog(shareableLink, sharingService.password)),
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
     * Hook into notebook saves using the saveState signal to handle CKHub sharing
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

          // Check if notebook has already been shared
          const notebookId = notebookContent?.metadata?.sharedId as string;

          const isNewShare = !notebookId;

          if (isNewShare) {
            // First time sharing - show dialog to get notebook name
            const result = await showDialog({
              title: 'Share Notebook',
              body: new ShareDialog(),
              buttons: [Dialog.cancelButton(), Dialog.okButton()]
            });

            if (result.button.accept) {
              const { notebookName } = result.value as IShareDialogData;
              const password = generatePassword();

              try {
                const shareResponse = await sharingService.share(notebookContent, password);

                let shareableLink = '';
                if (shareResponse && shareResponse.notebook) {
                  notebookContent.metadata = {
                    ...notebookContent.metadata,
                    sharedId: shareResponse.notebook.id,
                    readable_id: shareResponse.notebook.readable_id,
                    sharedName: notebookName,
                    isPasswordProtected: true
                  };

                  notebookPanel.context.model.fromJSON(notebookContent);
                  await notebookPanel.context.save();

                  const id = shareResponse.notebook.readable_id || shareResponse.notebook.id;
                  shareableLink = sharingService.makeRetrieveURL(id).toString();
                }

                if (shareableLink) {
                  const dialogResult = await showDialog({
                    title: '',
                    body: ReactWidget.create(createSuccessDialog(shareableLink, password)),
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
            // Already shared - just show the link (no password, no name dialog)
            await handleNotebookSave(notebookPanel, true);
          }
        } catch (error) {
          console.error('Error in share command:', error);
        }
      }
    });
  }
};

export default [plugin, notebookPlugin, files, competitions, customSidebar];
