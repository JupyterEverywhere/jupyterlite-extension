import { TabBar, Widget } from '@lumino/widgets';
import { ILabShell, JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { Dialog } from '@jupyterlab/apputils';

import { SidebarIcon } from './ui-components/SidebarIcon';
import { EverywhereIcons } from './icons';
import {
  LEAVE_CONFIRMATION_TITLE,
  LeaveConfirmation,
  LeaveDialog
} from './ui-components/LeaveConfirmation';
import { Commands } from './commands';

import { INotebookTracker } from '@jupyterlab/notebook';
import { INotebookContent } from '@jupyterlab/nbformat';
import { IViewOnlyNotebookTracker } from './view-only';
import { isNotebookEmpty } from './notebook-utils';

export const customSidebar: JupyterFrontEndPlugin<void> = {
  id: 'jupytereverywhere:sidebar',
  autoStart: true,
  requires: [ILabShell, INotebookTracker, IViewOnlyNotebookTracker],
  activate: (
    app: JupyterFrontEnd,
    shell: ILabShell,
    tracker: INotebookTracker,
    readonlyTracker: IViewOnlyNotebookTracker
  ) => {
    // Overwrite behaviour of the sidebar panel
    const leftHandler = shell['_leftHandler'];
    const sidebar: TabBar<Widget> = leftHandler._sideBar;
    leftHandler._refreshVisibility = () => {
      sidebar.setHidden(false);
      leftHandler._stackedPanel.setHidden(true);
      leftHandler._updated.emit();
    };
    sidebar.currentChanged.connect(
      (_sender: TabBar<Widget>, args: TabBar.ICurrentChangedArgs<Widget>) => {
        const oldWidget = args.previousTitle
          ? leftHandler._findWidgetByTitle(args.previousTitle)
          : null;
        const newWidget = args.currentTitle
          ? leftHandler._findWidgetByTitle(args.currentTitle)
          : null;
        if (newWidget && newWidget instanceof SidebarIcon) {
          const cancel = newWidget.execute();
          if (cancel) {
            console.log('Attempting to revert to:', oldWidget?.label);
            if (args.previousTitle) {
              const previousIndex = sidebar.titles.indexOf(oldWidget);
              if (previousIndex >= 0) {
                sidebar.currentIndex = previousIndex;
              } else {
                sidebar.currentIndex = -1;
              }
            } else {
              sidebar.currentIndex = -1;
            }
          }
        }
      },
      this
    );
    // Add Jupyter Everywhere icon
    shell.add(
      new SidebarIcon({
        label: 'Jupyter Everywhere',
        icon: EverywhereIcons.logo,
        execute: () => {
          void (async () => {
            const readOnlyNotebookPanel = readonlyTracker.currentWidget;
            const notebookPanel = tracker.currentWidget;

            // If a view-only notebook is open: skip dialog and go home,
            // as we cannot save the notebook anyway + we can assume the
            // user retrieved the URL from somewhere (either someone else's
            // or their own notebook) to paste or share in the first place
            if (readOnlyNotebookPanel) {
              window.location.href = '/index.html';
              return;
            }

            // If we have a new notebook, decide based on emptiness.
            if (notebookPanel) {
              const content = notebookPanel.context.model.toJSON() as INotebookContent;
              const empty = isNotebookEmpty(content);

              if (empty) {
                window.location.href = '/index.html';
                return;
              }

              // Non-empty regular notebook -> confirm and optionally save/share
              const dialog = new LeaveDialog({
                title: LEAVE_CONFIRMATION_TITLE,
                body: new LeaveConfirmation(),
                hasClose: true,
                buttons: [
                  Dialog.createButton({
                    label: "Don't save and leave",
                    accept: true,
                    actions: ['leave-nosave']
                  }),
                  Dialog.okButton({
                    label: 'Save and leave',
                    actions: ['leave-save']
                  })
                ],
                defaultButton: 1
              });

              const result = await dialog.launch();
              const actions = result.button.actions ?? [];

              if (actions.includes('leave-nosave')) {
                window.location.href = '/index.html';
                return;
              }
              if (actions.includes('leave-save')) {
                try {
                  await app.commands.execute(Commands.shareNotebookCommand);
                } catch (error) {
                  console.error(
                    'Failed to share notebook before leaving to the Landing page:',
                    error
                  );
                }
                window.location.href = '/index.html';
              }
              return;
            }
          })();

          return true;
        }
      }),
      'left',
      { rank: 0 }
    );
  }
};
