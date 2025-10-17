import { showDialog, Dialog } from '@jupyterlab/apputils';
import { ReactWidget } from '@jupyterlab/apputils';
import { PathExt } from '@jupyterlab/coreutils';
import React from 'react';

/**
 * The value returned by the Rename dialog.
 */
export interface IRenameDialogValue {
  newName: string;
}

/**
 * The body of the Rename dialog, containing a single input field.
 * The current name is passed in the constructor.
 */
class RenameDialogBody extends ReactWidget {
  private _value: string;

  constructor(private _currentName: string) {
    super();
    this._value = _currentName;
    this.addClass('je-RenameDialog');
  }

  getValue(): IRenameDialogValue {
    return { newName: (this._value ?? '').trim() };
  }

  protected render(): React.ReactElement {
    return (
      <div className="je-RenameDialog-body">
        <label htmlFor="je-rename-input" className="je-RenameDialog-label">
          New name
        </label>
        <input
          id="je-rename-input"
          type="text"
          defaultValue={this._currentName}
          onChange={e => {
            this._value = (e.target as HTMLInputElement).value;
          }}
          onFocus={e => {
            const ext = PathExt.extname(this._currentName);
            const value = e.target.value;
            e.target.setSelectionRange(0, value.length - ext.length);
          }}
          style={{ width: '100%', marginTop: 8, padding: 6 }}
        />
      </div>
    );
  }
}

/**
 * Opens the Rename dialog with Cancel and Rename actions.
 * @param currentName The current name to pre-fill in the input field.
 * @returns A promise that resolves to the dialog result.
 */
export async function openRenameDialog(
  currentName: string
): Promise<Dialog.IResult<IRenameDialogValue>> {
  const body = new RenameDialogBody(currentName);
  return showDialog<IRenameDialogValue>({
    title: 'Rename file',
    body,
    buttons: [Dialog.cancelButton({ label: 'Cancel' }), Dialog.okButton({ label: 'Rename' })],
    focusNodeSelector: 'input',
    defaultButton: 1
  });
}
