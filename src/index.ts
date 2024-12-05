import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import {
  INotebookTracker,
  //INotebookModel,
  NotebookActions,
  NotebookPanel
} from '@jupyterlab/notebook';
import {ReadonlyPartialJSONObject,} from '@lumino/coreutils';
import { ITranslator} from '@jupyterlab/translation';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { 
  Dialog, 
  showDialog,
  ICommandPalette,
  ToolbarButton, 
  showErrorMessage} from '@jupyterlab/apputils';
import { Widget } from '@lumino/widgets';
import { PageConfig} from '@jupyterlab/coreutils';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { fileUploadIcon } from '@jupyterlab/ui-components'; // Import JupyterLab's built-in upload icon
import { INotebookContent } from '@jupyterlab/nbformat';
import { SharingService } from './sharing-service';
import { API_URL } from './config';


/**
 * HELP FUNCTIONS 
 */

// Get the current widget and activate unless the args specify otherwise.
    function getCurrent(
      tracker: INotebookTracker,
      shell: JupyterFrontEnd.IShell,
      args: ReadonlyPartialJSONObject
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
  requires: [INotebookTracker,ISettingRegistry, ICommandPalette, ITranslator, IDocumentManager],
  activate: (
    app: JupyterFrontEnd, 
    tracker:INotebookTracker,
    translator: ITranslator,
    docManager: IDocumentManager,
    settingRegistry: ISettingRegistry | null) => {
    const sharingService = new SharingService(API_URL);
    console.log('JupyterLab extension jupytereverywhere is activated!');

    // Check if commands were disabled on system settings via schema/plugin.json
    app.restored.then(() => {
      console.log('notebook:cut-cell Command Enabled:',app.commands.isEnabled('notebook:cut-cell'));
      console.log('notebook:copy-cell Command Enabled:',app.commands.isEnabled('notebook:copy-cell'));
      console.log('notebook:paste-cell-below Command Enabled:',app.commands.isEnabled('notebook:paste-cell-below'));
      console.log('notebook:cut-cell Command Enabled:',app.commands.isEnabled('notebook:cut-cell'));
      console.log('notebook:insert-cell-above Command Enabled:',app.commands.isEnabled('notebook:insert-cell-above'));
      console.log('notebook:insert-cell-below Command Enabled:',app.commands.isEnabled('notebook:insert-cell-below'));
    });
    
    // Assign commands and shell properties to local variables 
    const { commands, shell } = app;

    /**
     * Add custom upload button
     */
    const uploadNotebookCommand = 'jupytereverywhere:upload-notebook';
    commands.addCommand(uploadNotebookCommand, {
      label: 'Upload Notebook',
      execute: async () => {
        const inputElement = document.createElement('input');
        inputElement.type = 'file';
        inputElement.accept = '.ipynb'; // Accept only Jupyter Notebook files
        inputElement.style.display = 'none';

        // Listen for file selection
        inputElement.onchange = async (event) => {
          const file = (event.target as HTMLInputElement)?.files?.[0];
          if (file) {
            try {
              // Read the notebook file content
              const content = await file.text();

              // Create a new notebook and set the content
              const newModel = await docManager.newUntitled({
                type: 'notebook',
                path: '',
              });
              const newContext = await docManager.open(newModel.path) as NotebookPanel;
              if (newContext) {
                newContext.context.model.fromString(content);
              }

              console.log('Notebook uploaded successfully');
            } catch (error) {
              console.error('Failed to upload notebook:', error);
              showErrorMessage('Upload Error', 'Failed to upload notebook.');
            }
          }
        };

        // Trigger file input click to open file dialog
        inputElement.click();
      },
    });

    /**
     * Add the upload button to the toolbar
     */
    // Allowed file extensions
    const allowedExtensions = ['.ipynb', '.csv', '.tsv', '.json', '.png', '.jpg', '.jpeg'];

    // Function to validate file type
    function validateFile(file: File): boolean {
      const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      return allowedExtensions.includes(extension);
    }

    // Create the upload button
    const uploadButton = new ToolbarButton({
      label: 'Upload',
      icon: fileUploadIcon,
      tooltip: 'Upload a notebook, dataset, or image',
      onClick: async () => {
        // Create a hidden file input element
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = allowedExtensions.join(','); // Limit to specific file types
        input.multiple = true; // Allow multiple files if needed

        // Trigger the file picker dialog
        input.click();

        // Handle file selection
        input.onchange = async () => {
          if (input.files) {
            const files = Array.from(input.files);
            const invalidFiles = files.filter(file => !validateFile(file));

            if (invalidFiles.length > 0) {
              // Show a warning dialog for invalid files
              await showDialog({
                title: 'Invalid File Type',
                body: `The following files are not allowed: ${invalidFiles.map(f => f.name).join(', ')}`,
                buttons: [Dialog.okButton({ label: 'OK' })]
              });
            } else {
              // Proceed with uploading valid files
              console.log('Valid files:', files.map(f => f.name));
              // Add your custom upload logic here
            }
          }
        };
      }
    });

    // Add the upload button to the toolbar as the first item on the left
    tracker.widgetAdded.connect((_, notebookPanel) => {
      if (notebookPanel) {
        notebookPanel.toolbar.insertItem(0, 'uploadButton', uploadButton); // Insert at position 0
      }
    });

    /**
    * Add custom save button command 
    */
    const linkCheckpoint = 'jupytereverywhere:save-link';
    let firstClick = true; // Track if this is the first click

    commands.addCommand(linkCheckpoint, {
      label: 'Create checkpoint and show link',
      execute: async () => { // Declare the function as async
        // Generate Shareable Link 
        const shareableLink = 'https://example.com/notebook/sharelink'; // TODO: Replace with dynamic link logic
    
        if (firstClick) {
          // Display the message for the first click
          const result = await showDialog({
            title: '',
            body: new Widget({
              node: (() => {
                const container = document.createElement('div');
                container.innerHTML = `
                  <p style="font-size: 1.2em; margin-bottom: 10px;">
                    Save the following information to access your notebook in a future session.
                    Here is the shareable link to your notebook:
                  </p>
                  <p>
                    <div style="text-align: center; margin: 10px 0;">
                      <a href="${shareableLink}" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        style="font-size: 1.1em; color: #007bff; text-decoration: underline;">
                        ${shareableLink}
                      </a>
                    </div>
                  </p>
                  <p style="font-size: 1.2em; margin-bottom: 10px;">
                    Here's the code required to edit the original notebook. Make sure to save this code as it will not appear again:
                  </p>
                  <p>
                    <div style="text-align: center; margin: 10px 0;">
                      <a href="${shareableLink}" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        style="font-size: 1.1em; color: #007bff; text-decoration: underline;">
                        ${shareableLink}
                      </a>
                    </div>
                  </p>
                `;
                return container;
              })()
            }),
            buttons: [
              Dialog.okButton({ label: 'Copy Link' }),
              Dialog.cancelButton({ label: 'Close' }),
            ]
          });

          // Handle the result
          if (result.button.label === 'Copy Link') {
            navigator.clipboard.writeText(shareableLink)
              .then(() => {
                console.log('Link copied to clipboard');
              })
              .catch((err) => {
                console.error('Failed to copy link to clipboard:', err);
              });
          }
          firstClick = false; // Update the flag
        } else {
          const result = await showDialog({
            title: 'Progress Saved',
            body: new Widget({
              node: (() => {
                const container = document.createElement('div');
                container.innerHTML = `
                  <p>Your work has successfully saved. Make sure to save your link to access your notebook in the future:</p>
                  <p>
                    <div style="text-align: center; margin: 10px 0;">
                      <a href="${shareableLink}" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        style="font-size: 1.1em; color: #007bff; text-decoration: underline;">
                        ${shareableLink}
                      </a>
                    </div>
                  </p>
                `;
                return container;
              })()
            }),
            buttons: [
              Dialog.okButton({ label: 'Copy Link' }),
              Dialog.cancelButton({ label: 'Close' }),
            ]
          });
    
          // Handle the result
          if (result.button.label === 'Copy Link') {
            navigator.clipboard.writeText(shareableLink)
              .then(() => {
                console.log('Link copied to clipboard');
              })
              .catch((err) => {
                console.error('Failed to copy link to clipboard:', err);
              });
          }
        }
      },
      isVisible: () => true
    });    

    // Add the command to a custom toolbar
    const savebutton = new ToolbarButton({
      className: 'jp-LinkCheckpointButton',
      iconClass: 'jp-MaterialIcon jp-SaveIcon',
      tooltip: 'Create checkpoint and show link',
      onClick: () => {
        commands.execute(linkCheckpoint);
      }
    });
    // Adding the button to a notebook toolbar
    tracker.widgetAdded.connect((_, notebookPanel) => {
      if (notebookPanel) {
        notebookPanel.toolbar.insertItem(1,'linkCheckpoint', savebutton);
      }
    });
    
    /**
    * Add empty markdown cell below 
    */
    const insertMarkdownBelow = 'jupytereverywhere:insert-markdown-cell';
    commands.addCommand(insertMarkdownBelow, {
      label: 'Execute jupytereverywhere:insert-markdown-cell Command',
      caption: 'Insert Text Cell',
      execute:  args => {
        const current = getCurrent(tracker, shell, args);
  
        if (current) {
          NotebookActions.insertBelow(current.content);
          return NotebookActions.changeCellType(current.content, 'markdown', translator);
        }
      }
    });


    /**
    * Add custom shareable link command 
    */
    const copyShareableLink = 'jupytereverywhere:copy-shareable-link';
    commands.addCommand(copyShareableLink, {
      label: 'shareable-link',
      execute: async () => {
        try {
          // ensure we are in a notebook panel
          const notebookPanel = tracker.currentWidget;
          if (!notebookPanel) {
            throw new Error('No active notebook to share.');
          }

          // share the notebook
          await notebookPanel.context.save();
          const notebookContent = notebookPanel.context.model.toJSON() as INotebookContent;
          // TODO: check if the notebook has already been shared, if so, update instead of creating
          // a new notebook. we could do this by setting the shared ID in the notebook metadata
          // after the first share (and also by ensuring that the ID is included in that same
          // metadata when the notebook is retrieved)
          const response = await sharingService.share(notebookContent); // TODO: password
          const shareableLink = sharingService.makeRetrieveURL(response.notebook.id);
    
          // Show a dialog with the shareable link and additional options
          const result = await showDialog({
            title: '',
            body: new Widget({
              node: (() => {
                const container = document.createElement('div');
                container.innerHTML = `
                  <p>Here is the shareable link to your notebook</p>
                  <p>
                    <div style="text-align: center; margin: 10px 0;">
                      <a href="${shareableLink}" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        style="font-size: 1.1em; color: #007bff; text-decoration: underline;">
                        ${shareableLink}
                      </a>
                    </div>
                  </p>
                `;
                return container;
              })()
            }),
            buttons: [
              Dialog.okButton({ label: 'Copy Link' }),
              Dialog.cancelButton({ label: 'Close' }),
            ]
          });

        // Handle the result
        if (result.button.label === 'Copy Link') {
          navigator.clipboard.writeText(shareableLink.toString());
          console.log('Link copied to clipboard');
        }

        } catch (error) {
          console.error('Error generating shareable link:', error);
          showErrorMessage('Error', 'Could not generate the shareable link.');
        }
      },
      isVisible: () => true
    });

    // Add the command to a custom toolbar
    const button = new ToolbarButton({
      label: 'Share notebook',
      className: 'jp-ShareableLinkButton',
      iconClass: 'jp-MaterialIcon jp-LinkIcon',
      tooltip: 'Copy shareable link',
      onClick: () => {
        commands.execute(copyShareableLink);
      }
    });

    // Attach the button to a notebook toolbar (as an example)
    tracker.widgetAdded.connect((_, notebookPanel) =>{
      if (notebookPanel) {
        notebookPanel.toolbar.insertAfter('restart-and-run', 'copyShareableLink', button);
      }
    })
     

    /**
    * Create notebook PDF command 
    */
    const pdfDownload = 'jupytereverywhere:download-as-pdf';
    commands.addCommand(pdfDownload, {
      label: 'Export Notebook to PDF',
      execute: args => {
        // Get the current active notebook using helper function
        const current = getCurrent(tracker, shell, args);

        // If there is no active notebook, do nothing
        if (!current) {
          return;
        }

        // Generate the URL for exporting the notebook using the specified format
        const url = PageConfig.getNBConvertURL({
          format: 'PDF',
          download:true,
          path: current.context.path
        });

        // Destructure the notebook context for easier access
        const { context } = current;

        // If the notebook has unsaved changes and is not read-only:
        if (context.model.dirty && !context.model.readOnly) {
          // Save the notebook first, then open the export URL
          return context.save().then(() => {
            window.open(url, '_blank', 'noopener');
          });
        }

        // else the notebook is already saved, just open the export URL 
        return new Promise<void>(resolve => {
          window.open(url, '_blank', 'noopener');
          resolve(undefined);
        });
      }, 
    });

    /**
    * Add the dropdown download menu command
    */
    // TODO: Integrate the dropdown with Schema
    const dropdownMenuCommand = 'jupytereverywhere:dropdown-menu';
    commands.addCommand(dropdownMenuCommand, {
      label: 'Dropdown Menu',
      execute: () => {
        // This can be empty since the toolbar button will render the widget
      },
      isVisible: () => true
    });

    // Add the dropdown menu to the toolbar dynamically
    tracker.widgetAdded.connect((_, notebookPanel) => {
      if (notebookPanel && !notebookPanel.isDisposed) {
        const dropdown = new Widget();
        dropdown.node.innerHTML = `
          <select class="jp-Dropdown">
            <option value="">Download Notebook</option>
            <option value="ipynb">as Python Notebook</option>
            <option value="pdf">as PDF</option>
          </select>
        `;
        dropdown.node.querySelector('select')?.addEventListener('change', (event) => {
          const value = (event.target as HTMLSelectElement).value;
          if (value === 'ipynb') {
            console.log('Jupyter Notebook Downloaded');
            commands.execute('docmanager:download');
          } else if (value === 'pdf') {
            console.log('Jupyter Notebook PDF Downloaded');
            commands.execute('jupytereverywhere:download-as-pdf');
          }
        });

        // Add the dropdown to the notebook panel's toolbar
        notebookPanel.toolbar.insertBefore("spacer", 'dropdown-menu', dropdown);
      }
    }); 

  }
};


export default plugin;
