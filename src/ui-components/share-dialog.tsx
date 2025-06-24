import { ReactWidget } from '@jupyterlab/apputils';

import React from 'react';

/**
 * Share dialog data interface.
 */
export interface IShareDialogData {
  notebookName: string;
}

/**
 * Share dialog widget component.
 */
function generateDefaultNotebookName(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  return `Notebook_${date}_${time}`;
}

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
    this._notebookName = generateDefaultNotebookName();
  }

  getValue(): IShareDialogData {
    // Get current values from the DOM
    const nameInput = this.node.querySelector('#notebook-name') as HTMLInputElement;

    return {
      notebookName: nameInput?.value || this._notebookName
    };
  }

  render() {
    const [notebookName, setNotebookName] = React.useState(this._notebookName);
    return <ShareDialogComponent notebookName={notebookName} onNameChange={setNotebookName} />;
  }
}

/**
 * Success dialog - shows the shareable link after a successful notebook save operation.
 */
export const createSuccessDialog = (shareableLink: string): React.JSX.Element => {
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
