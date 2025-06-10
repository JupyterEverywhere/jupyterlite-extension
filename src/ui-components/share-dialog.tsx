import { ReactWidget } from '@jupyterlab/apputils';

import React from 'react';

/**
 * Share dialog data interface.
 */
export interface IShareDialogData {
  notebookName: string;
  password: string;
}

/**
 * Share dialog widget for notebook sharing preferences (name, view-only, and a password if applicable).
 */
const ShareDialogComponent = () => {
  const generateDefaultName = () => {
    const today = new Date();
    return `Notebook_${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
  };

  // Generate random password
  // TODO: get this from the sharing service API later on
  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const [notebookName, setNotebookName] = React.useState<string>(generateDefaultName());
  const [password] = React.useState<string>(generatePassword());

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

      <div style={{ marginBottom: '15px' }}>
        <label htmlFor="password">
          Here's the code required to edit the original notebook. Make sure to save this code as it
          will not appear again:
        </label>
        <div
          id="password"
          style={{
            width: '100%',
            padding: '5px',
            fontFamily: 'monospace',
            fontSize: '14px'
          }}
        >
          {password}
        </div>
      </div>
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
    const passwordDiv = this.node.querySelector('#password') as HTMLDivElement;

    if (nameInput && passwordDiv && passwordDiv.textContent) {
      return {
        notebookName: nameInput.value,
        password: passwordDiv.textContent
      };
    }

    // Fallback to stored values
    return {
      notebookName: this._notebookName,
      password: '' // This shouldn't really happen since the component always renders a password
    };
  }

  render() {
    return <ShareDialogComponent />;
  }
}

// TODO: not used until the shareable link works
export const createSuccessDialog = (
  shareableLink: string,
  isNewShare: boolean,
  isViewOnly: boolean
) => {
  return (
    <div>
      <p style={{ fontSize: '1.2em', marginBottom: '15px' }}>
        {isNewShare ? 'Your notebook is now shared!' : 'Your notebook has been updated!'} Use this
        link to access it:
      </p>

      <div
        style={{
          textAlign: 'center',
          margin: '15px 0',
          padding: '10px',
          background: '#f5f5f5',
          borderRadius: '4px'
        }}
      >
        <a
          href={shareableLink}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: '1.1em',
            color: '#007bff',
            textDecoration: 'underline',
            wordBreak: 'break-all'
          }}
        >
          {shareableLink}
        </a>
      </div>

      {isViewOnly && (
        <p style={{ marginTop: '15px' }}>
          <strong>Note:</strong> This notebook is password-protected.
        </p>
      )}
    </div>
  );
};

export const createErrorDialog = (error: unknown) => {
  return (
    <div>
      <p>Failed to share notebook: {error instanceof Error ? error.message : 'Unknown error'}</p>
    </div>
  );
};
