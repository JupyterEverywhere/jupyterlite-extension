import { TabBar, Widget } from '@lumino/widgets';
import { ILabShell, JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { SidebarIcon } from './ui-components/SidebarIcon';
import { EverywhereIcons } from './icons';

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
          console.log('TODO');
          return true;
        }
      }),
      'left',
      { rank: 0 }
    );
  }
};
