import { ReactWidget } from '@jupyterlab/apputils';
import React from 'react';

import { generateDefaultNotebookName } from '../notebook-name';

/**
 * Share dialog data interface.
 */
export interface IShareDialogData {
  notebookName: string;
}

/**
 * Share dialog widget component.
 *
 * @param props - The component props are:
 *   - notebookName: The current notebook name to display in the input field.
 *   - onNameChange: Callback invoked when the notebook name is edited.
 * @returns A JSX element containing a labelled input field for renaming the notebook.
 */
const ShareDialogComponent: React.FC<{
  notebookName: string;
  onNameChange: (name: string) => void;
}> = ({ notebookName, onNameChange }) => {
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onNameChange(e.target.value);
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

  /**
   * Retrieve the notebook name from the input field.
   *
   * @returns An object containing the notebook name entered by the user.
   */
  getValue(): IShareDialogData {
    // Get current values from the DOM
    const nameInput = this.node.querySelector('#notebook-name') as HTMLInputElement;
    return {
      notebookName: nameInput?.value || this._notebookName
    };
  }

  /**
   * Renders the React component for the share dialog.
   *
   * @returns A JSX element that represents the share dialog.
   */
  render() {
    const [notebookName, setNotebookName] = React.useState(this._notebookName);
    return <ShareDialogComponent notebookName={notebookName} onNameChange={setNotebookName} />;
  }
}

/**
 * Success dialog - shows the shareable link after a successful notebook save operation.
 *
 * @param shareableLink - The URL that allows users to view the shared notebook.
 * @returns A React element containing the shareable link with styling.
 */
export const createSuccessDialog = (shareableLink: string): React.JSX.Element => {
  return <div className="je-share-link">{shareableLink}</div>;
};

/**
 * Creates an error dialog component for displaying notebook sharing
 * failures. It displays a generic error message.
 *
 * @param error - The error that occurred during notebook sharing. Can
 *                be an Error object or any other value.
 * @returns A React JSX element containing the formatted error message.
 */
export const createErrorDialog = (error: unknown): React.JSX.Element => {
  return (
    <div>
      <p>Failed to share notebook: {error instanceof Error ? error.message : 'Unknown error'}</p>
    </div>
  );
};
