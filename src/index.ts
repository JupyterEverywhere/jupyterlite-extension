import { ILabShell, JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { Dialog, showDialog, ReactWidget } from '@jupyterlab/apputils';
import { PageConfig } from '@jupyterlab/coreutils';
import { INotebookContent } from '@jupyterlab/nbformat';

import { customSidebar } from './sidebar';
import { SharingService } from './sharing-service';

import { createSuccessDialog, createErrorDialog } from './ui-components/share-dialog';

import { exportNotebookAsPDF } from './pdf';
import { files } from './pages/files';
import { Commands } from './commands';
import { competitions } from './pages/competitions';
import { notebookPlugin } from './pages/notebook';
import { generateDefaultNotebookName } from './notebook-name';
import {
  IViewOnlyNotebookTracker,
  viewOnlyNotebookFactoryPlugin,
  ViewOnlyNotebookPanel
} from './view-only';

/**
 * Generate a shareable URL for the currently active notebook.
 * @param notebookID – The ID of the notebook to share (can be readable_id or sharedId).
 * @returns A URL string that points to the notebook with the given notebookID.
 */
function generateShareURL(notebookID: string): string {
  const currentUrl = new URL(window.location.href);
  const baseUrl = `${currentUrl.protocol}//${currentUrl.host}${currentUrl.pathname}`;
  return `${baseUrl}?notebook=${notebookID}`;
}

const manuallySharing = new WeakSet<NotebookPanel | ViewOnlyNotebookPanel>();

/**
 * Show a dialog with a shareable link for the notebook.
 * @param sharingService - The sharing service instance to use for generating the shareable link.
 * @param notebookContent - The content of the notebook to share, from which we extract the ID.
 */
async function showShareDialog(sharingService: SharingService, notebookContent: INotebookContent) {
  // Grab the readable ID, or fall back to the UUID.
  const readableID = notebookContent.metadata?.readableId as string | null;
  const sharedID = notebookContent.metadata?.sharedId as string;

  const notebookID = readableID ?? sharedID;

  if (!notebookID) {
    console.error('No notebook ID found for sharing');
    return;
  }

  const shareableLink = generateShareURL(notebookID);

  const dialogResult = await showDialog({
    title: 'Here is the shareable link to your notebook:',
    body: ReactWidget.create(createSuccessDialog(shareableLink)),
    buttons: [Dialog.okButton({ label: 'Copy Link!' })]
  });

  if (dialogResult.button.label === 'Copy Link!') {
    try {
      await navigator.clipboard.writeText(shareableLink);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  }
}

/**
 * Notebook share/save handler. This function handles both sharing a new notebook and
 * updating an existing shared notebook.
 * @param notebookPanel - The notebook panel to handle sharing for.
 * @param sharingService - The sharing service instance to use for sharing operations.
 * @param manual - Whether this is a manual share operation triggered by the user, i.e., it is
 * true when the user clicks "Share Notebook" from the menu.
 */
async function handleNotebookSharing(
  notebookPanel: NotebookPanel | ViewOnlyNotebookPanel,
  sharingService: SharingService,
  manual: boolean
) {
  const notebookContent = notebookPanel.context.model.toJSON() as INotebookContent;

  const sharedId = notebookContent.metadata?.sharedId as string | undefined;
  const defaultName = generateDefaultNotebookName();

  try {
    if (sharedId) {
      console.log('Updating notebook:', sharedId);
      await sharingService.update(sharedId, notebookContent);

      console.log('Notebook automatically synced to CKHub');
    } else {
      const shareResponse = await sharingService.share(notebookContent);

      notebookContent.metadata = {
        ...notebookContent.metadata,
        sharedId: shareResponse.notebook.id,
        readableId: shareResponse.notebook.readable_id,
        sharedName: defaultName,
        lastShared: new Date().toISOString()
      };

      notebookPanel.context.model.fromJSON(notebookContent);
      await notebookPanel.context.save();
    }

    if (manual) {
      await showShareDialog(sharingService, notebookContent);
    }
  } catch (error) {
    console.warn('Failed to sync notebook to CKHub:', error);
    await showDialog({
      title: manual ? 'Error Sharing Notebook' : 'Sync Failed',
      body: ReactWidget.create(createErrorDialog(error)),
      buttons: [Dialog.okButton()]
    });
  }
}

/**
 * JUPYTEREVERYWHERE EXTENSION
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupytereverywhere:plugin',
  description: 'A Jupyter extension for k12 education',
  autoStart: true,
  requires: [INotebookTracker, IViewOnlyNotebookTracker],
  activate: (
    app: JupyterFrontEnd,
    tracker: INotebookTracker,
    readonlyTracker: IViewOnlyNotebookTracker
  ) => {
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
     * Hook into notebook saves using the saveState signal to handle CKHub sharing
     */
    tracker.widgetAdded.connect((sender, widget) => {
      widget.context.saveState.connect(async (sender, saveState) => {
        // Only trigger when save is completed (not dirty and not saving)
        if (saveState === 'completed') {
          if (manuallySharing.has(widget)) {
            // Skip auto-sync if it's a manual share.
            return;
          }
          await handleNotebookSharing(widget, sharingService, false);
        }
      });
    });

    /**
     * 1. A "Download as IPyNB" command.
     */
    commands.addCommand(Commands.downloadNotebookCommand, {
      label: 'Download as a notebook',
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
        const panel = readonlyTracker.currentWidget ?? tracker.currentWidget;

        if (!panel) {
          console.warn('No active notebook to download as PDF');
          return;
        }

        try {
          await exportNotebookAsPDF(panel);
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
          const notebookPanel = readonlyTracker.currentWidget
            ? readonlyTracker.currentWidget
            : tracker.currentWidget;
          if (!notebookPanel) {
            console.warn('Notebook panel not found, no notebook to share');
            return;
          }

          // Mark this notebook as being shared manually (i.e., the user has
          // clicked the "Share Notebook" command).
          manuallySharing.add(notebookPanel);

          // Save the notebook before we share it.
          await notebookPanel.context.save();

          await handleNotebookSharing(notebookPanel, sharingService, true);
        } catch (error) {
          console.error('Error in share command:', error);
        }
      }
    });
    /**
     * Add a custom Save and Share notebook command. This command
     * is activated only on key bindings (Accel S) and is used to
     * display the shareable link dialog after the notebook is
     * saved manually by the user.
     */
    commands.addCommand('jupytereverywhere:save-and-share', {
      label: 'Save and Share Notebook',
      execute: async () => {
        const panel = readonlyTracker.currentWidget ?? tracker.currentWidget;
        if (!panel) {
          console.warn('No active notebook to save');
          return;
        }
        if (panel.context.model.readOnly) {
          console.info('Notebook is read-only, skipping save-and-share.');
          return;
        }
        manuallySharing.add(panel);
        await panel.context.save();
        await handleNotebookSharing(panel, sharingService, true);
      }
    });

    app.commands.addKeyBinding({
      command: 'jupytereverywhere:save-and-share',
      keys: ['Accel S'],
      selector: '.jp-Notebook'
    });

    /**
     * Add custom Create Copy notebook command
     * Note: this command is supported and displayed only for View Only notebooks.
     */
    commands.addCommand(Commands.createCopyNotebookCommand, {
      label: 'Create Copy',
      execute: async () => {
        try {
          const readonlyPanel = readonlyTracker.currentWidget;

          if (!readonlyPanel) {
            console.warn('No view-only notebook is currently active.');
            return;
          }

          const originalContent = readonlyPanel.context.model.toJSON() as INotebookContent;
          // Remove any sharing-specific metadata from the copy,
          // as we create a fresh notebook with new metadata below.
          const purgedMetadata = { ...originalContent.metadata };
          delete purgedMetadata.isSharedNotebook;
          delete purgedMetadata.sharedId;
          delete purgedMetadata.readableId;
          delete purgedMetadata.domainId;
          delete purgedMetadata.sharedName;
          delete purgedMetadata.lastShared;

          const copyContent: INotebookContent = {
            ...originalContent,
            metadata: purgedMetadata
          };

          const result = await app.serviceManager.contents.newUntitled({
            type: 'notebook'
          });

          await app.serviceManager.contents.save(result.path, {
            type: 'notebook',
            format: 'json',
            content: copyContent
          });

          // Open the notebook in the normal notebook factory, and
          // close the previously opened notebook (th view-only one).
          await commands.execute('docmanager:open', {
            path: result.path
          });
          await readonlyPanel.close();

          // Remove notebook param from the URL
          const currentUrl = new URL(window.location.href);
          currentUrl.searchParams.delete('notebook');
          window.history.replaceState({}, '', currentUrl.toString());

          console.log(`Notebook copied as: ${result.path}`);
        } catch (error) {
          console.error('Failed to create notebook copy:', error);
          await showDialog({
            title: 'Error while creating a copy of the notebook',
            body: ReactWidget.create(createErrorDialog(error)),
            buttons: [Dialog.okButton()]
          });
        }
      }
    });
  }
};

export default [
  viewOnlyNotebookFactoryPlugin,
  plugin,
  notebookPlugin,
  files,
  competitions,
  customSidebar
];
