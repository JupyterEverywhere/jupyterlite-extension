import { NotebookPanel } from '@jupyterlab/notebook';
import { PathExt } from '@jupyterlab/coreutils';

import jsPDF from 'jspdf';

/**
 * Export a notebook panel as a PDF by rasterizing the DOM using jsPDF + html2canvas.
 */
export async function exportNotebookAsPDF(notebook: NotebookPanel): Promise<void> {
  const name = PathExt.basename(
    notebook.context.path,
    PathExt.extname(notebook.context.path)
  );

  const doc = new jsPDF({
    orientation: 'portrait',
    format: 'a4'
  });

  await doc.html(notebook.content.node, {
    callback: () => {
      doc.save(`${name}.pdf`);
    },
    html2canvas: {
      scale: 0.25 // lowering the scale for smaller PDFs; we could tune this later
    }
  });
}
