import { JupyterFrontEndPlugin, JupyterFrontEnd } from '@jupyterlab/application';
import { MainAreaWidget, ReactWidget } from '@jupyterlab/apputils';
import { Commands } from '../commands';
import { SidebarIcon } from '../ui-components/SidebarIcon';
import { PageTitle } from '../ui-components/PageTitle';
import { EverywhereIcons } from '../icons';
import React from 'react';

export class HelpCentre extends ReactWidget {
  constructor() {
    super();
    this.addClass('je-Help');
  }
  protected render() {
    return (
      <div>
        <h3>About</h3>
        <p>
          Jupyter Everywhere (JE) is a collaborative project between Skew the Script and CourseKata
          launched in 2024 with support from the Gates Foundation. Our initiative focuses on
          bringing data science tools and resources into classrooms by providing accessible
          high-quality tools. Our goal is to empower both teachers and students to explore data
          science and statistics with ease, fostering deeper engagement and understanding in these
          essential fields.
        </p>
        <h3>Get Started</h3>
        <p>Follow these steps to get started with the Jupyter Everywhere platform...</p>
        <ol>
          <li>
            <h4>Open the Magic Portal</h4>
            Go to the Jupyter Everywhere website (no login needed—yay!).
          </li>
          <li>
            <h4>Create an R or Python Notebook</h4>
            Instantly drop into a blank Jupyter notebook powered by WebAssembly — no setup, just
            vibes.
          </li>
          <li>
            <h4>Upload your files</h4>
            Want to use data and add images? Well you can! Use the left navigation bar to upload
            your files by clicking the file icon. Simply drag in your own CSV or PNG/JPG files or
            click the add files button.
          </li>
          <li>
            <h4>Code Like a Wizard</h4>
            Run some cells, make a plot, maybe even do some linear regression. Sky’s the limit.
          </li>
          <li>
            <h4>Hit “Share” to Make a Magic Link</h4>
            When you're ready, hit the Share button to get a link. Great for showing off.
          </li>
          <li>
            <h4>Send the Link to a Friend or Teacher</h4>
            Boom—now someone else can view your Jupyter notebook via JE.
          </li>
          <li>
            <h4>Make a Copy if You’re in View-Only Mode</h4>
            If someone sends you a notebook and you want to edit, just click "Make a Copy" to tinker
            freely. Once done, make sure to save again to create a new link.
          </li>
          <li>
            <h4>Come Back Later</h4>
            Your notebook lives in the cloud. If you have your magic link you can access your
            notebook in any other computer, on the go, and even at home. No rush to finish, just
            come back later with your shared link, create a copy, and continue working wherever you
            go.
          </li>
        </ol>
        <h3>JE User Guide</h3>
        The user guide will help you get started coding in your favorite language:
        <ul>
          <li>
            Click{' '}
            <a href="https://docs.google.com/document/d/1k05giO8HYKiLtdyS1pWM7GOJuxsQ0ww2Q-PrO9xRaxE/edit">
              here
            </a>{' '}
            for an R Coding Guide
          </li>
          <li>
            Click{' '}
            <a href="https://docs.google.com/document/d/1J_STDSo_9JJvsS87GIB7wY-lGAgr4lza3hoXaYDJnw8/edit">
              here
            </a>{' '}
            for a Python Coding Guide
          </li>
        </ul>
        <p>
          Need help with a coding or notebook question? Check out our{' '}
          <a href="https://jupytereverywhere.freeflarum.com/">Community Forum</a>
          <br />
          Need to report something? Fill out{' '}
          <a href="https://forms.gle/SAi65HfqhkSzygMr7">the Google Form</a>
          <br />
        </p>
      </div>
    );
  }
}
export const helpPlugin: JupyterFrontEndPlugin<void> = {
  id: 'jupytereverywhere:help',
  autoStart: true,
  activate: (app: JupyterFrontEnd) => {
    const newWidget = () => {
      const content = new HelpCentre();
      const widget = new MainAreaWidget({ content });
      widget.id = 'je-help';
      widget.title.label = 'Help Center';
      widget.title.closable = true;
      widget.title.icon = EverywhereIcons.help;
      const toolbarTitle = new PageTitle({
        label: 'Help Center',
        icon: EverywhereIcons.help
      });
      widget.toolbar.addItem('title', toolbarTitle);
      return widget;
    };
    let widget = newWidget();

    app.shell.add(
      new SidebarIcon({
        label: 'Help Centre',
        icon: EverywhereIcons.help,
        execute: () => {
          void app.commands.execute(Commands.openHelp);
          return;
        }
      }),
      'left',
      { rank: 300 }
    );

    app.commands.addCommand(Commands.openHelp, {
      label: 'Open Help Center',
      execute: () => {
        // Regenerate the widget if disposed
        if (widget.isDisposed) {
          widget = newWidget();
        }
        if (!widget.isAttached) {
          // Attach the widget to the main work area if it's not there
          app.shell.add(widget, 'main');
        }
        app.shell.activateById(widget.id);
      }
    });
  }
};
