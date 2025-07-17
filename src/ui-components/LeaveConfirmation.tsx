import { ReactWidget } from '@jupyterlab/apputils';
import React from 'react';

export const LEAVE_CONFIRMATION_TITLE =
  'Would you like to save the link to your notebook before navigating away?';

/**
 * A dialog widget that asks users if they want to share the notebook
 * before navigating away from the current page.
 */
export class LeaveConfirmation extends ReactWidget {
  render(): JSX.Element {
    return (
      <>
        <p>
          Note: To edit your work later, you'll have to save the link to your notebook and make a
          copy.
        </p>
      </>
    );
  }
}
