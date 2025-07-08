// Adapted from https://github.com/jupyterlite/jupyterlite/pull/1625

// SPDX-License-Identifier: BSD-3-Clause

/**
BSD 3-Clause License

Copyright (c) 2022, JupyterLite Contributors
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.

* Neither the name of the copyright holder nor the names of its
  contributors may be used to endorse or promote products derived from
  this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

import { INotebookModel, Notebook } from '@jupyterlab/notebook';
import { PathExt } from '@jupyterlab/coreutils';
import { DocumentWidget } from '@jupyterlab/docregistry';

import jsPDF from 'jspdf';
import { ViewOnlyNotebook } from './view-only';

/**
 * Export a notebook panel as a PDF by rasterizing the DOM using jsPDF + html2canvas.
 */
export function exportNotebookAsPDF(
  notebook: DocumentWidget<Notebook | ViewOnlyNotebook, INotebookModel>
): Promise<void> {
  const name = PathExt.basename(notebook.context.path, PathExt.extname(notebook.context.path));

  const doc = new jsPDF({ orientation: 'portrait', format: 'a4' });

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
      html2canvas: { scale: 0.25 }
    });
  });
}
