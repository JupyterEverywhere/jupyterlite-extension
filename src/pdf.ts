import { NotebookPanel } from '@jupyterlab/notebook';
import { PathExt } from '@jupyterlab/coreutils';
import jsPDF from 'jspdf';

/**
 * Export a notebook panel as a PDF by rasterizing the DOM using jsPDF + html2canvas.
 */
export function exportNotebookAsPDF(notebook: NotebookPanel): Promise<void> {
  const name = PathExt.basename(
    notebook.context.path,
    PathExt.extname(notebook.context.path)
  );

  const doc = new jsPDF({
    orientation: 'portrait',
    format: 'a4'
  });

  return new Promise((resolve, reject) => {
    doc.html(notebook.content.node, {
      callback: () => {
        try {
          doc.save(`${name}.pdf`);
          resolve();
        } catch (err) {
          reject(err);
        }
      },
      html2canvas: {
        scale: 0.25
      }
    });
  });
}
