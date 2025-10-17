import { showDialog, Dialog } from '@jupyterlab/apputils';

/**
 * Shows a dialog informing the user that one or more files already exist.
 * @param fileNames - an array of conflicting file names.
 * @returns - A promise that resolves when the dialog is closed.
 */
export async function showUploadConflictDialog(fileNames: string[]): Promise<void> {
  let body: string;

  if (fileNames.length === 1) {
    body = `A file named "${fileNames[0]}" already exists. Please choose a different file to upload, or rename the file before uploading.`;
  } else {
    const fileList = fileNames.map(name => `"${name}"`).join(', ');
    body = `The following files already exist: ${fileList}. Please choose different files to upload, or rename the files before uploading.`;
  }

  await showDialog({
    title: fileNames.length === 1 ? 'File already exists' : 'Files already exist',
    body,
    buttons: [Dialog.okButton({ label: 'Close' })]
  });
}
