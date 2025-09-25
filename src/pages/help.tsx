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
            Open the Magic Portal
            <br />
            Go to the Jupyter Everywhere website (no login needed—yay!).
          </li>
          <li>
            Click “Start Coding”
            <br />
            Instantly drop into a blank Jupyter notebook powered by WebAssembly — no setup, just
            vibes.
          </li>
          <li>
            Choose Your Sidekick
            <br />
            Python or R? Pick your language.
          </li>
          <li>
            Load a Dataset or Create a New One
            <br />
            Use built-in sample data or drag in your own CSV. Bonus: It doesn’t get uploaded
            anywhere unless you say so.
          </li>
          <li>
            Code Like a Wizard
            <br />
            Run some cells, make a plot, maybe even do some linear regression. Sky’s the limit.
          </li>
          <li>
            Hit “Share” to Make a Magic Link
            <br />
            When you're ready, hit the Share button to get a link + optional password. Great for
            showing off.
          </li>
          <li>
            Send the Link to a Friend or Teacher
            <br />
            Boom—now someone else can view or edit (if they have the password).
          </li>
          <li>
            Make a Copy if You’re in View-Only Mode
            <br />
            If someone sends you a notebook and it’s locked down, just click "Make a Copy" to tinker
            freely.
          </li>
          <li>
            Come Back Later (If You Have the Link + Password)
            <br />
            Your notebook lives in the cloud for a bit. Use your secret combo to get back in and
            keep working.
          </li>
        </ol>
        <h3>JE User Guide</h3>
        The user guide will help you get started coding in your favorite language:
        <ul>
          <li>
            Click <a href="#">here</a> for an R Coding Guide
          </li>
          <li>
            Click <a href="#">here</a> for a Python Coding Guide
          </li>
        </ul>
        <p>
          Need help with a coding or notebook question? Check out our{' '}
          <a href="https://jupytereverywhere.freeflarum.com/">Community Forum</a>
          <br />
          Found a bug in the platform? Post a{' '}
          <a href="https://github.com/JupyterEverywhere/jupyterlite-extension/issues">
            GitHub issue
          </a>
          <br />
          Need to report something? <a href="https://forms.gle/DG42BpS8EKpmNCFD9">Fill out</a>
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
