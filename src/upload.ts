import { UUID } from '@lumino/coreutils';

/**
 * Initializes the notebook upload handler. It dynamically creates a
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

      const uploadId = UUID.uuid4();
      localStorage.setItem(`uploaded-notebook:${uploadId}`, JSON.stringify(parsed));

      // We can now redirect to JupyterLite with this notebook.
      window.location.href = `lab/index.html?uploaded-notebook=${uploadId}`;
    } catch (err) {
      alert('Failed to read this notebook: ' + (err instanceof Error ? err.message : String(err)));
    }
  });
}
