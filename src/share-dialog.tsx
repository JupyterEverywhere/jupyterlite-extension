import { ReactWidget } from '@jupyterlab/apputils';

import React from 'react';

/**
 * Share dialog data interface.
 */
export interface IShareDialogData {
  notebookName: string;
  isViewOnly: boolean;
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

  const [notebookName, setNotebookName] = React.useState(generateDefaultName());
  const [isViewOnly, setIsViewOnly] = React.useState(false);
  const [password, setPassword] = React.useState(generatePassword());

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNotebookName(e.target.value);
  };

  const handleViewOnlyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsViewOnly(e.target.checked);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
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
        <input
          id="view-only"
          type="checkbox"
          checked={isViewOnly}
          onChange={handleViewOnlyChange}
          style={{ marginRight: '5px' }}
        />
        <label htmlFor="view-only">Share as view-only notebook (password-protected)</label>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label htmlFor="password">Password:</label>
        <input
          id="password"
          type="text"
          value={password}
          onChange={handlePasswordChange}
          disabled={!isViewOnly}
          style={{
            width: '100%',
            padding: '5px'
          }}
        />
      </div>
    </div>
  );
};

export class ShareDialog extends ReactWidget {
  private _notebookName: string;
  private _isViewOnly: boolean;
  private _password: string;

  constructor() {
    super();
    // Generate default values
    const today = new Date();
    this._notebookName = `Notebook_${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
    this._isViewOnly = false;

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this._password = password;
  }

  getValue(): IShareDialogData {
    // Get current values from the DOM
    const nameInput = this.node.querySelector('#notebook-name') as HTMLInputElement;
    const viewOnlyCheckbox = this.node.querySelector('#view-only') as HTMLInputElement;
    const passwordInput = this.node.querySelector('#password') as HTMLInputElement;

    if (nameInput && viewOnlyCheckbox && passwordInput) {
      return {
        notebookName: nameInput.value,
        isViewOnly: viewOnlyCheckbox.checked,
        password: passwordInput.value
      };
    }

    // Fallback to stored values
    return {
      notebookName: this._notebookName,
      isViewOnly: this._isViewOnly,
      password: this._password
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
