import { showDialog, Dialog } from '@jupyterlab/apputils';
import { ReactWidget } from '@jupyterlab/apputils';
import { PathExt } from '@jupyterlab/coreutils';
import { Message } from '@lumino/messaging';
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
  private _inputNode: HTMLInputElement | null = null;

  constructor(private _currentName: string) {
    super();
    this._value = _currentName;
    this.addClass('je-RenameDialog');
  }

  getValue(): IRenameDialogValue {
    return { newName: (this._value ?? '').trim() };
  }

  onAfterAttach(msg: Message): void {
    super.onAfterAttach(msg);
    if (this._inputNode) {
      const ext = PathExt.extname(this._currentName);
      const value = this._inputNode.value;
      this._inputNode.setSelectionRange(0, value.length - ext.length);
    }
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
          ref={node => {
            this._inputNode = node;
          }}
          onChange={e => {
            this._value = (e.target as HTMLInputElement).value;
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
