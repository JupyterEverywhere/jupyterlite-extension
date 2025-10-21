import { JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { ReactWidget } from '@jupyterlab/apputils';
import React from 'react';
import { Commands } from '../commands';

class NotFoundView extends ReactWidget {
  constructor() {
    super();
    this.addClass('je-NotFound');
  }

  protected render(): React.ReactElement {
    return (
      <div className="je-NotFound-container">
        <div className="je-NotFound-content">
          <div className="je-NotFound-code">404</div>
          <h2 className="je-NotFound-title">Oops! We could not find what you are looking for.</h2>
          <p className="je-NotFound-message">
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
      const widget = new NotFoundView();
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
