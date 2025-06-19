import { ReactWidget } from '@jupyterlab/apputils';

import React from 'react';

/**
 * Share dialog data interface.
 */
export interface IShareDialogData {
  notebookName: string;
  password?: string;
}

/**
 * Share dialog widget for notebook sharing preferences (name, view-only, and a password if applicable).
 */
const ShareDialogComponent: React.FC = () => {
  const generateDefaultName = () => {
    const today = new Date();
    return `Notebook_${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
  };

  const [notebookName, setNotebookName] = React.useState<string>(generateDefaultName());

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNotebookName(e.target.value);
  };

  return (
    <div>
      <label htmlFor="notebook-name">Notebook Name:</label>
      <input
        id="notebook-name"
        type="text"
        value={notebookName}
        onChange={handleNameChange}
        style={{
          width: '100%',
          marginBottom: '15px',
          padding: '5px'
        }}
        required
      />
    </div>
  );
};

export class ShareDialog extends ReactWidget {
  private _notebookName: string;

  constructor() {
    super();
    // Generate default values
    const today = new Date();
    this._notebookName = `Notebook_${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
  }

  getValue(): IShareDialogData {
    // Get current values from the DOM
    const nameInput = this.node.querySelector('#notebook-name') as HTMLInputElement;

    return {
      notebookName: nameInput?.value || this._notebookName
    };
  }

  render() {
    return <ShareDialogComponent />;
  }
}

/**
 * Success dialog - shows actual URLs and passwords, minimal styling
 * Shows password only when isNewShare is true.
 */
export const createSuccessDialog = (
  shareableLink: string,
  password?: string
): React.JSX.Element => {
  return (
    <div>
      <h3>Here is the shareable link to your notebook:</h3>
      <div
        style={{
          backgroundColor: '#f0f0f0',
          padding: '10px',
          borderRadius: '5px',
          marginBottom: '20px',
          wordBreak: 'break-all',
          fontFamily: 'monospace'
        }}
      >
        {shareableLink}
      </div>

      {password && (
        <>
          <p>
            Here's the code required to edit the original notebook. Make sure to save this code as
            it will not appear again:
          </p>
          <div
            style={{
              backgroundColor: '#f0f0f0',
              padding: '10px',
              borderRadius: '5px',
              marginBottom: '20px',
              fontFamily: 'monospace',
              fontSize: '14px',
              letterSpacing: '1px'
            }}
          >
            {password}
          </div>
        </>
      )}
    </div>
  );
};

/**
 * Creates an error dialog component for displaying notebook sharing
 * failures. It displays a generic error message.
 *
 * @param error - The error that occurred during notebook sharing. Can
 * be an Error object or any other value.
 * @returns A React JSX element containing the formatted error message.
 */
export const createErrorDialog = (error: unknown) => {
  return (
    <div>
      <p>Failed to share notebook: {error instanceof Error ? error.message : 'Unknown error'}</p>
    </div>
  );
};
