import { JupyterFrontEnd, JupyterFrontEndPlugin, IRouter } from '@jupyterlab/application';
import { Commands } from './commands';

const ROUTE_FILES_CMD = Commands.routeFiles;

const routesPlugin: JupyterFrontEndPlugin<void> = {
  id: 'jupytereverywhere:routes',
  autoStart: true,
  optional: [IRouter],
  activate: (app: JupyterFrontEnd, router: IRouter | null) => {
    if (!router) {
      return;
    }

    // WWe wait for the app to be fully restored so the Files plugin is registered
    // (I'm not sure if the order matters).
    app.commands.addCommand(ROUTE_FILES_CMD, {
      label: 'Open Files (route)',
      execute: async () => {
        await app.restored;
        await app.commands.execute(Commands.openFiles);
      }
    });

    const base = router.base.replace(/\/+$/, '');
    const patterns = [
      /^\/files(?:\/.*)?$/,
      new RegExp(`^${base.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}/files(?:/.*)?$`)
    ];

    patterns.forEach(pattern => {
      router.register({ command: ROUTE_FILES_CMD, pattern });
    });

    router.route(window.location.pathname + window.location.search + window.location.hash);
  }
};

export default routesPlugin;
