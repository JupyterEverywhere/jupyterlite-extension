import { JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { MainAreaWidget, ReactWidget } from '@jupyterlab/apputils';
import React from 'react';
import { Commands } from '../commands';

class NotFoundView extends ReactWidget {
  constructor() {
    super();
    this.addClass('je-NotFound');
  }
  protected render(): React.ReactElement {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '24px'
        }}
      >
        <div>
          <div style={{ opacity: 0.5, marginBottom: 12, fontSize: 48 }}>404</div>
          <h2 style={{ margin: '0 0 8px' }}>Oops! We could not find what you are looking for.</h2>
          <p style={{ margin: 0, opacity: 0.8 }}>
            The page may have moved or the link might be incorrect.
          </p>
        </div>
      </div>
    );
  }
}

export const notFoundPlugin: JupyterFrontEndPlugin<void> = {
  id: 'jupytereverywhere:not-found',
  autoStart: true,
  activate: (app: JupyterFrontEnd) => {
    const newWidget = () => {
      const content = new NotFoundView();
      const widget = new MainAreaWidget({ content });
      widget.id = 'je-not-found';
      widget.title.label = 'Not found';
      widget.title.closable = true;
      return widget;
    };

    let widget = newWidget();

    app.commands.addCommand(Commands.openNotFound, {
      label: 'Open 404 Page',
      execute: () => {
        if (widget.isDisposed) {
          widget = newWidget();
        }
        if (!widget.isAttached) {
          app.shell.add(widget, 'main');
        }
        app.shell.activateById(widget.id);
      }
    });
  }
};

export default notFoundPlugin;
