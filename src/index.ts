import { JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { Dialog, showDialog, ReactWidget, Notification } from '@jupyterlab/apputils';
import { PageConfig } from '@jupyterlab/coreutils';
import { INotebookContent } from '@jupyterlab/nbformat';
import { IStateDB, StateDB } from '@jupyterlab/statedb';

import { customSidebar } from './sidebar';
import { SharingService } from './sharing-service';

import { createSuccessDialog, createErrorDialog } from './ui-components/share-dialog';

import { exportNotebookAsPDF } from './pdf';
import { files } from './pages/files';
import routesPlugin from './routes';
import { Commands } from './commands';
// import { competitions } from './pages/competitions';
import { notebookPlugin } from './pages/notebook';
// import { helpPlugin } from './pages/help';
import { generateDefaultNotebookName, isNotebookEmpty } from './notebook-utils';
import {
  IViewOnlyNotebookTracker,
  viewOnlyNotebookFactoryPlugin,
  ViewOnlyNotebookPanel
} from './view-only';

import { KERNEL_DISPLAY_NAMES, switchKernel } from './kernels';
import { singleDocumentMode } from './single-mode';
import { notebookFactoryPlugin } from './notebook-factory';
import { placeholderPlugin } from './placeholders';
import { EverywhereIcons } from './icons';
import { sessionDialogs } from './dialogs';

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

/**
 * Sets or updates the 'notebook' query parameter in the current URL to the given notebookID.
 * If the parameter already exists with the same value, no change is made.
 * @param notebookID - The ID of the notebook to set in the URL.
 */
function setNotebookParamInUrl(notebookID: string): void {
  const url = new URL(window.location.href);
  if (url.searchParams.get('notebook') !== notebookID) {
    url.searchParams.set('notebook', notebookID);
    window.history.replaceState({}, '', url.toString());
  }
}

const manuallySharing = new WeakSet<NotebookPanel | ViewOnlyNotebookPanel>();

/**
 * Show a dialog with a shareable link for the notebook.
 * @param sharingService - The sharing service instance to use for generating the shareable link.
 * @param notebookContent - The content of the notebook to share, from which we extract the ID.
 */
async function showShareDialog(sharingService: SharingService, notebookContent: INotebookContent) {
  // Grab the readable ID, or fall back to the UUID.
  const readableID = notebookContent.metadata?.readableId as string;
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
  manual: boolean,
  onManualSave: () => void
) {
  const notebookContent = notebookPanel.context.model.toJSON() as INotebookContent;

  const isViewOnly = notebookContent.metadata?.isSharedNotebook === true;
  const sharedId = notebookContent.metadata?.sharedId as string | undefined;
  const defaultName = generateDefaultNotebookName();

  // Mark that the user has performed at least one manual save in this session.
  // We do this early in the manual flow for clarity; the local save already happened
  // in the command handlers and this flag only affects reminder wording.
  if (manual && !isViewOnly) {
    onManualSave();
  }

  try {
    if (isViewOnly) {
      // Skip CKHub sync for view-only notebooks
      console.log('View-only notebook: skipping CKHub sync and showing share URL.');
      if (manual) {
        await showShareDialog(sharingService, notebookContent);
      }
      return;
    }
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

      try {
        const notebookID =
          (notebookContent.metadata?.readableId as string | undefined) ??
          (notebookContent.metadata?.sharedId as string | undefined);
        if (notebookID) {
          setNotebookParamInUrl(notebookID);
        }
      } catch (e) {
        console.warn('Failed to update URL with shareable notebook ID:', e);
      }
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
    const { commands } = app;

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
          await handleNotebookSharing(widget, sharingService, false, () => {});
        }
      });
    });

    /**
     * 1. A "Download as IPyNB" command.
     */
    commands.addCommand(Commands.downloadNotebookCommand, {
      label: 'Download as a notebook',
      execute: args => {
        // Clear all sharing-specific metadata before download
        const panel = readonlyTracker.currentWidget ?? tracker.currentWidget;

        if (!panel) {
          console.warn('No active notebook to download');
          return;
        }

        const content = panel.context.model.toJSON() as INotebookContent;

        // Remove sharing-specific metadata
        const purgedMetadata = { ...content.metadata };
        delete purgedMetadata.isSharedNotebook;
        delete purgedMetadata.sharedId;
        delete purgedMetadata.readableId;
        delete purgedMetadata.sharedName;
        delete purgedMetadata.lastShared;

        // Ensure that we preserve kernelspec metadata if present
        const kernelSpec = content.metadata?.kernelspec;
        if (kernelSpec) {
          purgedMetadata.kernelspec = kernelSpec;
        }

        const cleanedContent: INotebookContent = {
          ...content,
          metadata: purgedMetadata
        };
        panel.context.model.fromJSON(cleanedContent);

        // Execute the built-in download command with the cleaned model
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
     * Add a command to restart the notebook kernel, terming it as "memory",
     * and run all cells after the restart.
     */

    commands.addCommand(Commands.restartMemoryAndRunAllCommand, {
      label: 'Restart Notebook Memory and Run All Cells',
      icon: EverywhereIcons.fastForward,
      isEnabled: () => !!tracker.currentWidget,
      execute: async () => {
        const panel = tracker.currentWidget;
        if (!panel) {
          console.warn('No active notebook to restart and run.');
          return;
        }

        const result = await showDialog({
          title: 'Would you like to restart the notebook’s memory and rerun all cells?',
          buttons: [Dialog.cancelButton({ label: 'Cancel' }), Dialog.okButton({ label: 'Restart' })]
        });

        if (result.button.accept) {
          try {
            await panel.sessionContext.restartKernel();
            await commands.execute('notebook:run-all-cells');
          } catch (err) {
            console.error('Restarting and running all cells failed', err);
          }
        }
      }
    });

    // Track user time, and show a reminder to save the notebook once after
    // five minutes of editing (i.e., once it becomes non-empty and dirty)
    // using a toast notification.
    let saveReminderTimeout: number | null = null;
    let isSaveReminderScheduled = false; // a 5-minute timer is scheduled, but it hasn't fired yet
    let hasShownSaveReminder = false; // we've already shown the toast once for this notebook
    let hasManuallySaved = false; // whether the user has manually saved at least once in this session

    /**
     * Add custom Share notebook command
     */
    const markManualSave = () => {
      hasManuallySaved = true;
    };

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

          await handleNotebookSharing(notebookPanel, sharingService, true, markManualSave);
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
    commands.addCommand(Commands.saveAndShareNotebookCommand, {
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
        await handleNotebookSharing(panel, sharingService, true, markManualSave);
      }
    });

    app.commands.addKeyBinding({
      command: Commands.saveAndShareNotebookCommand,
      keys: ['Accel S'],
      selector: '.jp-Notebook'
    });

    commands.addCommand('jupytereverywhere:switch-kernel', {
      label: args => {
        const kernel = (args['kernel'] as string) || '';
        const isActive = args['isActive'] as boolean;
        const display = KERNEL_DISPLAY_NAMES[kernel] || kernel;

        if (isActive) {
          return display;
        }
        return `Switch to ${display}`;
      },
      execute: async args => {
        const kernel = args['kernel'] as string | undefined;
        const panel = tracker.currentWidget;

        if (!kernel) {
          console.warn('No kernel specified for switching.');
          return;
        }
        if (!panel) {
          console.warn('No active notebook panel.');
          return;
        }

        const currentKernel = panel.sessionContext.session?.kernel?.name || '';

        if (currentKernel !== kernel) {
          const currentKernelDisplay = KERNEL_DISPLAY_NAMES[currentKernel] || currentKernel;
          const targetKernelDisplay = KERNEL_DISPLAY_NAMES[kernel] || kernel;
          Notification.warning(
            `You are about to switch your notebook coding language from ${currentKernelDisplay} to ${targetKernelDisplay}. Your previously created code will not run as intended.`,
            { autoClose: 5000 }
          );
        }

        await switchKernel(panel, kernel);
      }
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

          // Ensure that we preserve kernelspec metadata if present
          const kernelSpec = originalContent.metadata?.kernelspec;

          // Remove cell-level editable=false; as the notebook has
          // now been copied and should be possible to write to.
          const cleanedCells =
            originalContent.cells?.map(cell => {
              const cellCopy = { ...cell };
              cellCopy.metadata = { ...cellCopy.metadata };
              delete cellCopy.metadata.editable;
              return cellCopy;
            }) ?? [];

          if (kernelSpec) {
            purgedMetadata.kernelspec = kernelSpec;
          }

          const copyContent: INotebookContent = {
            ...originalContent,
            cells: cleanedCells,
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
          // close the previously opened notebook (the view-only one).
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

    /**
     * Helper to start the save reminder timer. Clears any existing timer
     * and sets a new one to show the notification after 5 minutes.
     */
    function startSaveReminder(currentTimeout: number | null, onFire: () => void): number {
      if (currentTimeout) {
        window.clearTimeout(currentTimeout);
      }
      return window.setTimeout(() => {
        const message = hasManuallySaved
          ? "It's been 5 minutes since you last saved this notebook. Make sure to save the link to your notebook to edit your work later."
          : "It's been 5 minutes since you've been working on this notebook. Make sure to save the link to your notebook to edit your work later.";

        Notification.info(message, { autoClose: 8000 });
        onFire();
      }, 300 * 1000); // once after 5 minutes
    }

    tracker.widgetAdded.connect((_, panel) => {
      if (saveReminderTimeout) {
        window.clearTimeout(saveReminderTimeout);
        saveReminderTimeout = null;
      }
      isSaveReminderScheduled = false;
      hasShownSaveReminder = false;

      const maybeScheduleSaveReminder = () => {
        if (hasShownSaveReminder) {
          return;
        }

        const content = panel.context.model.toJSON() as INotebookContent;
        // Skip for view-only notebooks
        if (panel.context.model.readOnly || content.metadata?.isSharedNotebook === true) {
          return;
        }
        // Schedule after the notebook becomes non-empty
        if (isNotebookEmpty(content)) {
          return;
        }
        if (isSaveReminderScheduled) {
          return;
        }

        isSaveReminderScheduled = true;
        saveReminderTimeout = startSaveReminder(saveReminderTimeout, () => {
          hasShownSaveReminder = true;
          isSaveReminderScheduled = false;
        });
      };

      // After the model is ready, check immediately and on any content change.
      void panel.context.ready.then(() => {
        // We cover the case where the notebook loads already non-empty, say,
        // if the user uploads a notebook into the application.
        maybeScheduleSaveReminder();
        panel.context.model.contentChanged.connect(() => {
          maybeScheduleSaveReminder(); // schedule when first content appears
        });

        // Reset the reminder timer whenever the user saves manually.
        // We clear any pending timer and wait for the next edit (dirty state)
        // to schedule a fresh 5-minute reminder.
        panel.context.saveState.connect((_, state) => {
          if (state === 'completed') {
            if (saveReminderTimeout) {
              window.clearTimeout(saveReminderTimeout);
              saveReminderTimeout = null;
            }
            isSaveReminderScheduled = false;
            hasShownSaveReminder = false;
            // Note: we do not reschedule here; it will be scheduled on the next content change
            // once the notebook becomes dirty again.
          }
        });
      });

      // If a view-only notebook is opened or becomes active, ensure no reminder can fire.
      readonlyTracker.widgetAdded.connect(() => {
        if (saveReminderTimeout) {
          window.clearTimeout(saveReminderTimeout);
          saveReminderTimeout = null;
        }
        isSaveReminderScheduled = false;
        hasShownSaveReminder = false;
      });

      panel.disposed.connect(() => {
        if (saveReminderTimeout) {
          window.clearTimeout(saveReminderTimeout);
          saveReminderTimeout = null;
        }
      });
    });
  }
};

const stateDBShim: JupyterFrontEndPlugin<IStateDB> = {
  id: '@jupyter-everywhere/apputils-extension:state',
  autoStart: true,
  provides: IStateDB,
  activate: (app: JupyterFrontEnd) => {
    return new StateDB();
  }
};

export default [
  stateDBShim,
  viewOnlyNotebookFactoryPlugin,
  notebookFactoryPlugin,
  plugin,
  notebookPlugin,
  files,
  routesPlugin,
  // competitions,
  customSidebar,
  // helpPlugin,
  singleDocumentMode,
  placeholderPlugin,
  sessionDialogs
];
