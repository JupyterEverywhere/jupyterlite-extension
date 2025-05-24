import { JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { INotebookTracker, NotebookActions, NotebookPanel } from '@jupyterlab/notebook';
import { ReadonlyPartialJSONObject } from '@lumino/coreutils';
import { ITranslator } from '@jupyterlab/translation';
import { Dialog, showDialog, ToolbarButton } from '@jupyterlab/apputils';
import { Widget } from '@lumino/widgets';
import { PageConfig } from '@jupyterlab/coreutils';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { linkIcon, downloadIcon, fileIcon, caretDownIcon } from '@jupyterlab/ui-components';
import { INotebookContent } from '@jupyterlab/nbformat';
import { Menu } from '@lumino/widgets';
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

class DownloadDropdownButton extends Widget {
  private _menu: Menu;

  constructor(commands: any) {
    super();
    this.addClass('jp-Toolbar-item');
    this.addClass('jp-Toolbar-button');

    // Create the menu
    this._menu = new Menu({ commands });
    this._menu.addClass('jp-ToolbarButton-menu');
    this._menu.addItem({ command: 'jupytereverywhere:download-notebook' });
    this._menu.addItem({ command: 'jupytereverywhere:download-pdf' });

    this._createButton();
  }

  private _createButton(): void {
    const button = document.createElement('button');
    button.className = 'jp-ToolbarButtonComponent jp-Button jp-mod-minimal jp-ToolbarButton';
    button.setAttribute('data-command', 'download-dropdown');
    button.title = 'Download notebook';

    // Create button content and icon containers
    const buttonContent = document.createElement('span');
    buttonContent.className = 'jp-ToolbarButtonComponent-label';

    const iconContainer = document.createElement('span');
    iconContainer.className = 'jp-ToolbarButtonComponent-icon';

    downloadIcon.element({
      container: iconContainer,
      elementPosition: 'center',
      height: 16,
      width: 16
    });

    const textSpan = document.createElement('span');
    textSpan.textContent = 'Download';
    textSpan.style.marginLeft = '4px';
    textSpan.style.marginRight = '4px';

    const dropdownArrow = document.createElement('span');
    dropdownArrow.className = 'jp-ToolbarButtonComponent-icon';
    caretDownIcon.element({
      container: dropdownArrow,
      elementPosition: 'center',
      height: 12,
      width: 12
    });

    buttonContent.appendChild(iconContainer);
    buttonContent.appendChild(textSpan);
    buttonContent.appendChild(dropdownArrow);
    button.appendChild(buttonContent);

    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      this._showMenu(event);
    });

    this.node.appendChild(button);
  }

  private _showMenu(event: MouseEvent): void {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this._menu.open(rect.left, rect.bottom);
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
      label: 'IPyNB',
      icon: fileIcon,
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
      label: 'PDF',
      icon: fileIcon,
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
                      container.innerHTML = `
                        <p style="font-size: 1.2em; margin-bottom: 15px;">
                          ${isNewShare ? 'Your notebook is now shared!' : 'Your notebook has been updated!'}
                          Use this link to access it:
                        </p>
                        <div style="text-align: center; margin: 15px 0; padding: 10px; background: #f5f5f5; border-radius: 4px;">
                          <a href="${shareableLink}"
                            target="_blank"
                            rel="noopener noreferrer"
                            style="font-size: 1.1em; color: #007bff; text-decoration: underline; word-break: break-all;">
                            ${shareableLink}
                          </a>
                        </div>
                        ${
                          isViewOnly
                            ? '<p style="margin-top: 15px;"><strong>Note:</strong> This notebook is password-protected.</p>'
                            : ''
                        }
                        <p style="font-size: 0.9em; margin-top: 15px;">
                          <strong>Important:</strong> Save this link to access your notebook later.
                        </p>
                      `;
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
                    container.innerHTML = `
                      <p>Failed to share notebook: ${error instanceof Error ? error.message : 'Unknown error'}</p>
                    `;
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
