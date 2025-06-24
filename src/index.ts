import { ILabShell, JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { ReadonlyPartialJSONObject } from '@lumino/coreutils';
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

const manuallySharing = new WeakSet<NotebookPanel>();

/**
 * Show a dialog with a shareable link for the notebook.
 * @param sharingService - The sharing service instance to use for generating the shareable link.
 * @param notebookContent - The content of the notebook to share, from which we extract the ID.
 */
async function showShareDialog(sharingService: SharingService, notebookContent: INotebookContent) {
  const id = (notebookContent.metadata.readableId || notebookContent.metadata.sharedId) as string;
  const shareableLink = sharingService.makeRetrieveURL(id).toString();

  const dialogResult = await showDialog({
    title: '',
    body: ReactWidget.create(createSuccessDialog(shareableLink)),
    buttons: [Dialog.okButton({ label: 'Copy Link!' }), Dialog.cancelButton({ label: 'Close' })]
  });

  if (dialogResult.button.label === 'Copy Link!') {
    try {
      await navigator.clipboard.writeText(shareableLink);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  }
}


async function handleNotebookSharing(
  notebookPanel: NotebookPanel,
  sharingService: SharingService,
  manual: boolean
) {
  const notebookContent = notebookPanel.context.model.toJSON() as INotebookContent;

  const sharedId = notebookContent.metadata?.sharedId as string | undefined;
  const defaultName = `Notebook_${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${new Date().getDate().toString().padStart(2, '0')}`;

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
  }
};

export default [plugin, notebookPlugin, files, competitions, customSidebar];
