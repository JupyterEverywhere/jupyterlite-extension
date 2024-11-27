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
//import { CommandRegistry } from '@lumino/commands';
//import { IDisposable } from '@lumino/disposable';
//import { DocumentRegistry } from '@jupyterlab/docregistry';


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
    * Add custom save button command 
    */
    const linkCheckpoint = 'jupytereverywhere:save-link';
    let firstClick = true; // Track if this is the first click

    commands.addCommand(linkCheckpoint, {
      label: 'Create checkpoint and show link',
      execute: () => {
        // Generate Sharable Link 
          // TODO: Implement API Generating Link Logic 
          const shareableLink = 'https://example.com/notebook/sharelink';

        if (firstClick) {
          // Display the message for the first click
          showErrorMessage(
            '',
            'Save the following infromation to access your notebook in a future session. Here is the sharable link to your noteboook'
          );
          firstClick = false; // Update the flag
        } else {
          showDialog({
            title: 'Progress Saved',
            body: new Widget({
              node: (() => {
                const container = document.createElement('div');
                container.innerHTML = `
                  <p>Your work has successfully saved. Make sure to save your link to access your notebook in the future:</p>
                  <p><a href="${shareableLink}" target="_blank" rel="noopener noreferrer">${shareableLink}</a></p>
                `;
                return container;
              })()
            }),
            buttons: [
              Dialog.okButton({ label: 'Copy Link' }),
              Dialog.cancelButton({ label: 'Close' }),
            ]
          });
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
      caption: 'Execute jupytereverywhere:insert-markdown-cell Command',
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
          // Simulate obtaining a shareable link (TODO: REPLACE WITH API LOGIC)
          const shareableLink = 'https://example.com/notebook/sharelink';
    
          // Show a dialog with the shareable link and additional options
          const result = await showDialog({
            title: 'Share your work!',
            body: `Here is the shareable link to your notebook: ${shareableLink}`,
            buttons: [
              Dialog.okButton({ label: 'Copy Link' }),
              Dialog.cancelButton({ label: 'Close' }),
            ]
          });

        // Handle the result
        if (result.button.label === 'Copy Link') {
          navigator.clipboard.writeText(shareableLink);
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
      tooltip: 'Copy Shareable Link',
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
