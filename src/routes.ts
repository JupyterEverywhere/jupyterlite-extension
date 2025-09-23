import { JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { ILiteRouter } from '@jupyterlite/application';
import { Commands } from './commands';
import { ILabShell } from '@jupyterlab/application';

const ROUTE_FILES_CMD = Commands.routeFiles;

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

    void app.restored.then(() => {
      const search = window.location.search || '';
      const params = new URLSearchParams(search);
      const tab = params.get('tab');

      if (tab === 'files') {
        void app.commands.execute(ROUTE_FILES_CMD).then(() => {
          // Drop ?tab so it doesn't linger.
          const url = new URL(window.location.href);
          url.searchParams.delete('tab');
          window.history.replaceState({}, '', url.toString());
        });
        return;
      }

      if (tab === 'notebook') {
        const tryActivate = async () => {
          const id = document.querySelector('.jp-NotebookPanel')?.id;
          if (id) {
            app.shell.activateById(id);
          }
          const url = new URL(window.location.href);
          url.searchParams.delete('tab');
          window.history.replaceState({}, '', url.toString());
        };
        tryActivate();
      }
    });

    const here = window.location.pathname + window.location.search + window.location.hash;

    if (filesPathPatterns.some(p => p.test(here))) {
      void app.restored.then(() => {
        void app.commands.execute(Commands.openFiles);
      });
    }
  }
};

export default routesPlugin;
