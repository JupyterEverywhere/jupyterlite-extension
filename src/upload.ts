import { UUID } from '@lumino/coreutils';
import type { INotebookContent } from '@jupyterlab/nbformat';

/**
 * Detects the language of the notebook from its metadata.
 * @param notebook - The notebook object to detect the language from.
 * @returns - 'python' if the notebook is a Python notebook, or
 * 'r' if it is an R notebook, or
 * null for indeterminate or unsupported languages (i.e., not Python and not R).
 */
export function detectNotebookLanguage(notebook: Partial<INotebookContent>): 'python' | 'r' | null {
  const language = (
    notebook?.metadata?.kernelspec?.language ||
    notebook?.metadata?.language_info?.name ||
    ''
  )
    .toString()
    .toLowerCase();

  if (language === 'python') {
    return 'python';
  }
  if (language === 'r') {
    return 'r';
  }
  return null;
}

/**
 * Initialises the notebook upload handler. It dynamically creates a
 * hidden file input, handles reading the IPyNB, stores it in localStorage,
 * and redirects to lab/index.html with its ID.
 * @param {File} file - The notebook file (.ipynb) to upload.
 * @returns {Promise<void>} - A promise that resolves when the upload is complete.
 */
export async function handleNotebookUpload(file: File): Promise<void> {
  try {
    const content = await file.text();
    const parsed = JSON.parse(content) as INotebookContent;

    const lang = detectNotebookLanguage(parsed);
    console.log(`Detected notebook language: ${lang}`);
    if (!lang) {
      alert('Only Python and R notebooks are supported. Please upload a valid notebook.');
      console.warn('Unsupported notebook language:', parsed);
      return;
    }

    const uploadId = UUID.uuid4();
    localStorage.setItem(`uploaded-notebook:${uploadId}`, JSON.stringify(parsed));

    // We can now redirect to JupyterLite with this notebook.
    window.location.href = `lab/index.html?uploaded-notebook=${uploadId}`;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('Failed to upload notebook:', errorMessage, err);
    alert(`Failed to read this notebook: ${errorMessage}`);
  }
}
