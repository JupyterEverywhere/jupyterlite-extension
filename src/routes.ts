import { JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { ILiteRouter } from '@jupyterlite/application';
import { Commands } from './commands';

const ROUTE_FILES_CMD = Commands.routeFiles;

const routesPlugin: JupyterFrontEndPlugin<void> = {
  id: 'jupytereverywhere:routes',
  autoStart: true,
  optional: [ILiteRouter],
  activate: (app: JupyterFrontEnd, router: ILiteRouter | null) => {
    if (!router) {
      return;
    }

    app.commands.addCommand(ROUTE_FILES_CMD, {
      label: 'Open Files (route)',
      execute: async () => {
        await app.restored;
        await app.commands.execute(Commands.openFiles);
      }
    });

    const base = router.base.replace(/\/+$/, '');
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const patterns = [/^\/files(?:\/.*)?$/, new RegExp(`^${esc(base)}\\/files(?:\\/.*)?$`)];
    patterns.forEach(pattern => router.register({ command: ROUTE_FILES_CMD, pattern }));

    // TODO: this won't work until we have a lab/files/index.html to land on.
    // Even if we do, then the extensions will fail to load due to invalid JSON.
    // Handle direct loads (e.g. if a user were to open /lab/files/ in a new tab)
    // const here = window.location.pathname + window.location.search + window.location.hash;
    // if (typeof (router as any).route === 'function') {
    //   (router as any).route(here);
    // } else {
    //     // Fallback: if URL matches our patterns, run the command.
    //     if (patterns.some(p => p.test(here))) {
    //     void app.commands.execute(Commands.openFiles);
    //   }
    // }
  }
};

export default routesPlugin;
