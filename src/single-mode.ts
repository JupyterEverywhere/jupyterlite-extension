import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
  ILabShell,
  IRouter
} from '@jupyterlab/application';
import { PageConfig } from '@jupyterlab/coreutils';

/**
 * Hard-enforce single-document mode after restore and keep the URL param in sync (?todo drop this and figure out the right schema?)
 */
export const singleDocumentMode: JupyterFrontEndPlugin<void> = {
  id: 'jupytereverywhere:force-single-mode',
  autoStart: true,
  optional: [IRouter, ILabShell],
  activate: (app: JupyterFrontEnd, router: IRouter | null, labShell: ILabShell | null) => {
    if (!labShell) {
      return;
    }

    const setSingle = () => {
      if (labShell.mode !== 'single-document') {
        labShell.mode = 'single-document';
      }

      PageConfig.setOption('mode', 'single-document');

      const url = new URL(window.location.href);
      if (url.searchParams.get('mode') !== 'single-document') {
        url.searchParams.set('mode', 'single-document');
        const next = `${url.pathname}${url.search}${url.hash}`;
        router?.navigate(next, { skipRouting: true });
      }
    };

    // 1) After the layout has been restored, assert single mode
    void app.restored.then(() => {
      setSingle();

      // 2) If anything later toggles mode (e.g. a workspace or a command), snap back to single
      labShell.modeChanged.connect((_sender, newMode) => {
        if (newMode !== 'single-document') {
          setSingle();
        }
      });

      // 3) Now drop mode=single-document URL param from URL
      const url = new URL(window.location.href);
      url.searchParams.delete('mode');
      const next = `${url.pathname}${url.search}${url.hash}`;
      router?.navigate(next, { skipRouting: true });
    });
  }
};
