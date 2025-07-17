import { ReactWidget } from '@jupyterlab/apputils';
import React from 'react';

export const LEAVE_CONFIRMATION_TITLE =
  'Would you like to save the link to your notebook before navigating away?';

/**
 * A dialog widget that asks users if they want to share the notebook
 * before navigating away from the current page.
 */
export class LeaveConfirmation extends ReactWidget {
  constructor() {
    super();
    this.addClass('je-LeaveDialog');
  }
  render(): JSX.Element {
    return (
      <>
        <div className="je-LeaveDialog-body">
          <p className="je-LeaveDialog-note">
            Note: To edit your work later, you'll have to save the link to your notebook and make a
            copy.
          </p>
        </div>
      </>
    );
  }
}
