import { JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { INotebookTracker, NotebookActions, NotebookPanel } from '@jupyterlab/notebook';
import { ReadonlyPartialJSONObject } from '@lumino/coreutils';
import { ITranslator } from '@jupyterlab/translation';
import { Dialog, showDialog, ToolbarButton, ReactWidget } from '@jupyterlab/apputils';
import { PageConfig } from '@jupyterlab/coreutils';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { linkIcon, downloadIcon, fileIcon } from '@jupyterlab/ui-components';
import { INotebookContent } from '@jupyterlab/nbformat';

import React from 'react';

import { SharingService } from './sharing-service';
import { DownloadDropdownButton } from './ui-components';

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
const ShareDialogComponent = () => {
  const generateDefaultName = () => {
    const today = new Date();
    return `Notebook_${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
  };

  // Generate random password
  // TODO: get this from the sharing service API later on
  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const [notebookName, setNotebookName] = React.useState(generateDefaultName());
  const [isViewOnly, setIsViewOnly] = React.useState(false);
  const [password, setPassword] = React.useState(generatePassword());

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNotebookName(e.target.value);
  };

  const handleViewOnlyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsViewOnly(e.target.checked);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
  };

  return React.createElement(
    'div',
    null,
    React.createElement('label', { htmlFor: 'notebook-name' }, 'Notebook Name:'),
    React.createElement('input', {
      id: 'notebook-name',
      type: 'text',
      value: notebookName,
      onChange: handleNameChange,
      style: {
        width: '100%',
        marginBottom: '15px',
        padding: '5px'
      },
      required: true
    }),

    React.createElement(
      'div',
      { style: { marginBottom: '15px' } },
      React.createElement('input', {
        id: 'view-only',
        type: 'checkbox',
        checked: isViewOnly,
        onChange: handleViewOnlyChange,
        style: { marginRight: '5px' }
      }),
      React.createElement(
        'label',
        { htmlFor: 'view-only' },
        'Share as view-only notebook (password-protected)'
      )
    ),

    React.createElement(
      'div',
      { style: { marginBottom: '15px' } },
      React.createElement('label', { htmlFor: 'password' }, 'Password:'),
      React.createElement('input', {
        id: 'password',
        type: 'text',
        value: password,
        onChange: handlePasswordChange,
        disabled: !isViewOnly,
        style: {
          width: '100%',
          padding: '5px'
        }
      })
    )
  );
};

class ShareDialog extends ReactWidget {
  private _notebookName: string;
  private _isViewOnly: boolean;
  private _password: string;

  constructor() {
    super();
    // Generate default values
    const today = new Date();
    this._notebookName = `Notebook_${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
    this._isViewOnly = false;

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this._password = password;
  }

  getValue(): IShareDialogData {
    // Get current values from the DOM
    const nameInput = this.node.querySelector('#notebook-name') as HTMLInputElement;
    const viewOnlyCheckbox = this.node.querySelector('#view-only') as HTMLInputElement;
    const passwordInput = this.node.querySelector('#password') as HTMLInputElement;

    if (nameInput && viewOnlyCheckbox && passwordInput) {
      return {
        notebookName: nameInput.value,
        isViewOnly: viewOnlyCheckbox.checked,
        password: passwordInput.value
      };
    }

    // Fallback to stored values
    return {
      notebookName: this._notebookName,
      isViewOnly: this._isViewOnly,
      password: this._password
    };
  }

  render() {
    return React.createElement(ShareDialogComponent);
  }
}

// TODO: not used until the shareable link works
const createSuccessDialog = (shareableLink: string, isNewShare: boolean, isViewOnly: boolean) => {
  const messageElement = React.createElement(
    'p',
    {
      style: { fontSize: '1.2em', marginBottom: '15px' }
    },
    `${isNewShare ? 'Your notebook is now shared!' : 'Your notebook has been updated!'} Use this link to access it:`
  );

  const linkElement = React.createElement(
    'div',
    {
      style: {
        textAlign: 'center',
        margin: '15px 0',
        padding: '10px',
        background: '#f5f5f5',
        borderRadius: '4px'
      }
    },
    React.createElement(
      'a',
      {
        href: shareableLink,
        target: '_blank',
        rel: 'noopener noreferrer',
        style: {
          fontSize: '1.1em',
          color: '#007bff',
          textDecoration: 'underline',
          wordBreak: 'break-all'
        }
      },
      shareableLink
    )
  );

  const passwordNoteElement = isViewOnly
    ? React.createElement(
        'p',
        {
          style: { marginTop: '15px' }
        },
        React.createElement('strong', null, 'Note:'),
        ' This notebook is password-protected.'
      )
    : null;

  // Filter out null elements and create the container
  const children = [messageElement, linkElement, passwordNoteElement].filter(Boolean);

  return React.createElement('div', null, ...children);
};

const createErrorDialog = (error: unknown) => {
  return React.createElement(
    'div',
    null,
    React.createElement(
      'p',
      null,
      `Failed to share notebook: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  );
};

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
      icon: downloadIcon,
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
