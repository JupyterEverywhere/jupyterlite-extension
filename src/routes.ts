import { JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { ILiteRouter } from '@jupyterlite/application';
import { Commands } from './commands';
import { ILabShell } from '@jupyterlab/application';

const ROUTE_FILES_CMD = Commands.routeFiles;
const ROUTE_NOT_FOUND_CMD = Commands.routeNotFound;

const routesPlugin: JupyterFrontEndPlugin<void> = {
  id: 'jupytereverywhere:routes',
  autoStart: true,
  optional: [ILiteRouter, ILabShell],
  activate: (app: JupyterFrontEnd, router: ILiteRouter | null, _labShell?: ILabShell | null) => {
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

    app.commands.addCommand(ROUTE_NOT_FOUND_CMD, {
      label: 'Open the "Not found" widget (route)',
      execute: async () => {
        await app.restored;
        await app.commands.execute(Commands.openNotFound);
      }
    });

    const base = router.base.replace(/\/+$/, '');
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // 1. Support direct files/ paths, as the redirect page lands there first.
    const filesPathPatterns = [
      /^\/files(?:\/.*)?$/,
      new RegExp(`^${esc(base)}\\/files(?:\\/.*)?$`)
    ];
    filesPathPatterns.forEach(pattern => router.register({ command: ROUTE_FILES_CMD, pattern }));

    // 2. Support /lab/index.html?tab=files (or ?tab=notebook). We register a
    // router handler that just inspects the query string.
    router.register({
      command: ROUTE_FILES_CMD,
      pattern: new RegExp(`^${esc(base)}\\/?(?:index\\.html)?\\?[^#]*\\btab=files\\b(?:[&#].*)?$`)
    });
    router.register({
      command: ROUTE_FILES_CMD,
      pattern: /^\/?(?:index\.html)?\?[^#]*\btab=files\b(?:[&#].*)?$/
    });

    const notFoundPathPatterns = [/^\/404(?:\/.*)?$/, new RegExp(`^${esc(base)}\\/404(?:\\/.*)?$`)];
    notFoundPathPatterns.forEach(pattern =>
      router.register({ command: ROUTE_NOT_FOUND_CMD, pattern })
    );

    router.register({
      command: ROUTE_NOT_FOUND_CMD,
      pattern: new RegExp(`^${esc(base)}\\/?(?:index\\.html)?\\?[^#]*\\btab=404\\b(?:[&#].*)?$`)
    });
    router.register({
      command: ROUTE_NOT_FOUND_CMD,
      pattern: /^\/?(?:index\.html)?\?[^#]*\btab=404\b(?:[&#].*)?$/
    });

    void app.restored.then(() => {
      const search = window.location.search || '';
      const params = new URLSearchParams(search);
      const tab = params.get('tab');

      if (tab === 'files') {
        void app.commands.execute(ROUTE_FILES_CMD).then(() => {
          const filesURL = new URL(`${base.replace(/\/$/, '')}/lab/files/`, window.location.origin);
          filesURL.hash = window.location.hash;
          window.history.replaceState(null, 'Files', filesURL.toString());
        });
        return;
      }

      if (tab === '404') {
        void app.commands.execute(ROUTE_NOT_FOUND_CMD).then(() => {
          const nfURL = new URL(`${base.replace(/\/$/, '')}/lab/404/`, window.location.origin);
          nfURL.hash = window.location.hash;
          window.history.replaceState(null, 'Not Found', nfURL.toString());
        });
        return;
      }

      if (tab === 'notebook') {
        const tryActivate = async () => {
          const id = document.querySelector('.jp-NotebookPanel')?.id;
          if (id) {
            app.shell.activateById(id);
          }
          const nbURL = new URL(
            `${base.replace(/\/$/, '')}/lab/index.html`,
            window.location.origin
          );
          nbURL.hash = window.location.hash;
          window.history.replaceState(null, 'Notebook', nbURL.toString());
        };
        tryActivate();
      }
    });

    const here = window.location.href;

    if (filesPathPatterns.some(p => p.test(here))) {
      void app.restored.then(() => {
        void app.commands.execute(Commands.openFiles);
      });
    }

    if (notFoundPathPatterns.some(p => p.test(here))) {
      void app.restored.then(() => {
        void app.commands.execute(Commands.openNotFound);
      });
    }
  }
};

export default routesPlugin;
