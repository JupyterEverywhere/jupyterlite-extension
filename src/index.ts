import { JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { INotebookTracker, NotebookActions, NotebookPanel } from '@jupyterlab/notebook';
import { ReadonlyPartialJSONObject } from '@lumino/coreutils';
import { ITranslator } from '@jupyterlab/translation';
import { Dialog, showDialog, ToolbarButton } from '@jupyterlab/apputils';
import { Widget } from '@lumino/widgets';
import { PageConfig } from '@jupyterlab/coreutils';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { linkIcon, downloadIcon, fileIcon } from '@jupyterlab/ui-components';
import { INotebookContent } from '@jupyterlab/nbformat';
import { SharingService } from './sharing-service';

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
 * Share dialog data interface.
 */
interface IShareDialogData {
  notebookName: string;
  isViewOnly: boolean;
  password: string;
}

/**
 * Share dialog widget for notebook sharing preferences (name, view-only, and a password if applicable).
 */
class ShareDialog extends Widget {
  constructor() {
    super();
    this.node.appendChild(this.createNode());
  }

  getValue(): IShareDialogData {
    const nameInput = this.node.querySelector('#notebook-name') as HTMLInputElement;
    const viewOnlyCheckbox = this.node.querySelector('#view-only') as HTMLInputElement;
    const passwordInput = this.node.querySelector('#password') as HTMLInputElement;

    return {
      notebookName: nameInput.value,
      isViewOnly: viewOnlyCheckbox.checked,
      password: passwordInput.value
    };
  }

  private createNode(): HTMLElement {
    const node = document.createElement('div');

    const nameLabel = document.createElement('label');
    nameLabel.htmlFor = 'notebook-name';
    nameLabel.textContent = 'Notebook Name:';

    const nameInput = document.createElement('input');
    nameInput.id = 'notebook-name';
    nameInput.type = 'text';
    nameInput.style.width = '100%';
    nameInput.style.marginBottom = '15px';
    nameInput.style.padding = '5px';
    nameInput.required = true;

    // For now, we can generate a default filename based on the
    // date sharing the notebook.
    const today = new Date();
    const defaultName = `Notebook_${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
    nameInput.value = defaultName;

    const viewOnlyContainer = document.createElement('div');
    viewOnlyContainer.style.marginBottom = '15px';

    const viewOnlyCheckbox = document.createElement('input');
    viewOnlyCheckbox.id = 'view-only';
    viewOnlyCheckbox.type = 'checkbox';
    viewOnlyCheckbox.style.marginRight = '5px';

    const viewOnlyLabel = document.createElement('label');
    viewOnlyLabel.htmlFor = 'view-only';
    viewOnlyLabel.textContent = 'Share as view-only notebook (password-protected)';

    viewOnlyContainer.appendChild(viewOnlyCheckbox);
    viewOnlyContainer.appendChild(viewOnlyLabel);

    // Password field
    const passwordContainer = document.createElement('div');
    passwordContainer.style.marginBottom = '15px';

    const passwordLabel = document.createElement('label');
    passwordLabel.htmlFor = 'password';
    passwordLabel.textContent = 'Password:';

    const passwordInput = document.createElement('input');
    passwordInput.id = 'password';
    passwordInput.type = 'text';
    passwordInput.style.width = '100%';
    passwordInput.style.padding = '5px';

    // This should be retrieved from the API but doesn't due to CORS issues;
    // generate a random password at this time.
    const generatePassword = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let password = '';
      for (let i = 0; i < 8; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return password;
    };

    passwordInput.value = generatePassword();
    passwordInput.disabled = !viewOnlyCheckbox.checked;

    // Toggle password field based on checkbox
    // TODO: doesn't yet dim the password field?
    viewOnlyCheckbox.addEventListener('change', () => {
      passwordInput.disabled = !viewOnlyCheckbox.checked;
    });

    passwordContainer.appendChild(passwordLabel);
    passwordContainer.appendChild(passwordInput);

    node.appendChild(nameLabel);
    node.appendChild(nameInput);
    node.appendChild(viewOnlyContainer);
    node.appendChild(passwordContainer);

    return node;
  }
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
      label: 'Download as Notebook (.ipynb)',
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
      execute: args => {
        const current = getCurrentNotebook(tracker, shell, args);
        if (!current) {
          return Promise.resolve();
        }

        // Generate the URL for exporting as PDF
        // TODO: make this not open a new tab but rather download the file directly
        // Probably a target="_blank" not working issue?
        const url = PageConfig.getNBConvertURL({
          format: 'pdf',
          download: true,
          path: current.context.path
        });

        return new Promise<void>(resolve => {
          // Execute all cells first before the notebook is exported
          // as the PDF export won't have the latest cell outputs otherwise
          void NotebookActions.runAll(current.content, current.context.sessionContext)
            .then(() => {
              // Save notebook if needed, then open the export URL
              const { context } = current;
              if (context.model.dirty && !context.model.readOnly) {
                void context
                  .save()
                  .then(() => {
                    window.open(url, '_blank', 'noopener');
                    resolve();
                  })
                  .catch(error => {
                    console.error('Failed to save notebook:', error);
                    resolve();
                  });
              } else {
                window.open(url, '_blank', 'noopener');
                resolve();
              }
            })
            .catch(error => {
              console.error('Failed while running notebook cells:', error);
              resolve();
            });
        });
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
                  body: new Widget({
                    node: (() => {
                      const container = document.createElement('div');
                      const mainMessage = document.createElement('p');
                      mainMessage.style.fontSize = '1.2em';
                      mainMessage.style.marginBottom = '15px';
                      mainMessage.textContent = `${isNewShare ? 'Your notebook is now shared!' : 'Your notebook has been updated!'} Use this link to access it:`;

                      const linkContainer = document.createElement('div');
                      linkContainer.style.textAlign = 'center';
                      linkContainer.style.margin = '15px 0';
                      linkContainer.style.padding = '10px';
                      linkContainer.style.background = '#f5f5f5';
                      linkContainer.style.borderRadius = '4px';

                      const linkElement = document.createElement('a');
                      linkElement.href = shareableLink;
                      linkElement.target = '_blank';
                      linkElement.rel = 'noopener noreferrer';
                      linkElement.style.fontSize = '1.1em';
                      linkElement.style.color = '#007bff';
                      linkElement.style.textDecoration = 'underline';
                      linkElement.style.wordBreak = 'break-all';
                      linkElement.textContent = shareableLink;

                      linkContainer.appendChild(linkElement);

                      if (isViewOnly) {
                        const passwordNote = document.createElement('p');
                        passwordNote.style.marginTop = '15px';

                        const strongElement = document.createElement('strong');
                        strongElement.textContent = 'Note:';
                        passwordNote.appendChild(strongElement);
                        passwordNote.appendChild(
                          document.createTextNode(' This notebook is password-protected.')
                        );

                        container.appendChild(mainMessage);
                        container.appendChild(linkContainer);
                        container.appendChild(passwordNote);
                      } else {
                        container.appendChild(mainMessage);
                        container.appendChild(linkContainer);
                      }

                      return container;
                    })()
                  }),
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
                body: new Widget({
                  node: (() => {
                    const container = document.createElement('div');

                    const errorParagraph = document.createElement('p');
                    errorParagraph.textContent = `Failed to share notebook: ${error instanceof Error ? error.message : 'Unknown error'}`;

                    container.appendChild(errorParagraph);

                    return container;
                  })()
                }),
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
     * Create a "Download IPyNB" button
     */
    const downloadIPyNBButton = new ToolbarButton({
      label: 'Download IPyNB',
      icon: downloadIcon,
      tooltip: 'Download this notebook as .ipynb',
      onClick: () => {
        void commands.execute(downloadNotebookCommand);
      }
    });

    /**
     * Create a "Download PDF" button
     */
    const downloadPDFButton = new ToolbarButton({
      label: 'Download PDF',
      icon: fileIcon,
      tooltip: 'Download this notebook as PDF',
      onClick: () => {
        void commands.execute(downloadPDFCommand);
      }
    });

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

        // Add download-IPyNB button
        try {
          toolbar.insertItem(insertIndex, 'downloadIPyNBButton', downloadIPyNBButton);
          insertIndex++;
        } catch (error) {
          toolbar.addItem('downloadIPyNBButton', downloadIPyNBButton);
        }

        // Add download-PDF button
        try {
          toolbar.insertItem(insertIndex, 'downloadPDFButton', downloadPDFButton);
          insertIndex++;
        } catch (error) {
          toolbar.addItem('downloadPDFButton', downloadPDFButton);
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
