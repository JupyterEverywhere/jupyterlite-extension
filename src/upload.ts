import { UUID } from '@lumino/coreutils';

/**
 * Detects the language of the notebook from its metadata.
 * @param notebook - The notebook object to detect the language from.
 * @returns - 'python' if the notebook is a Python notebook, or
 * 'r' if it is an R notebook, or
 * null for indeterminate or unsupported languages (i.e., not Python and not R).
 */
function detectNotebookLanguage(notebook: any): 'python' | 'r' | null {
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
 * hidden file input, handles reading the .ipynb, stores it in localStorage,
 * and redirects to lab/index.html with its ID.
 * @param {string} buttonSelector - The CSS selector for the upload button.
 * @returns {void}
 */
export function initUploadHandler(buttonSelector: string): void {
  const uploadButton = document.querySelector<HTMLAnchorElement>(buttonSelector);
  if (!uploadButton) {
    console.warn(`Upload button not found: ${buttonSelector}`);
    return;
  }

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.ipynb,application/json';
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);

  uploadButton.addEventListener('click', e => {
    e.preventDefault();
    fileInput.click();
  });

  fileInput.addEventListener('change', async e => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const content = await file.text();
      const parsed = JSON.parse(content);

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
      alert('Failed to read this notebook: ' + (err instanceof Error ? err.message : String(err)));
    }
  });
}
