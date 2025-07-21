import { TabBar, Widget } from '@lumino/widgets';
import { ILabShell, JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { Dialog, showDialog } from '@jupyterlab/apputils';

import { SidebarIcon } from './ui-components/SidebarIcon';
import { EverywhereIcons } from './icons';
import { LEAVE_CONFIRMATION_TITLE, LeaveConfirmation } from './ui-components/LeaveConfirmation';
import { Commands } from './commands';

export const customSidebar: JupyterFrontEndPlugin<void> = {
  id: 'jupytereverywhere:sidebar',
  autoStart: true,
  requires: [ILabShell],
  activate: (app: JupyterFrontEnd, shell: ILabShell) => {
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
            console.log('Attempting to revert to:', oldWidget.label);
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
            const result = await showDialog({
              title: LEAVE_CONFIRMATION_TITLE,
              body: new LeaveConfirmation(),
              buttons: [
                Dialog.cancelButton({ label: 'Cancel' }),
                Dialog.okButton({ label: 'Yes' })
              ],
              defaultButton: 0
            });

            if (result.button.label === 'Yes') {
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
          })();

          return true;
        }
      }),
      'left',
      { rank: 0 }
    );
  }
};
