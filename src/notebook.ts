import {
  ICell,
  INotebookContent,
  isCode,
  isMarkdown,
  isRaw
} from '@jupyterlab/nbformat';

export interface INotebookModel {
  password: string;
  notebook: INotebookContent;
}

export function validateNotebookContent(
  value: unknown
): value is INotebookContent {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const notebook = value as INotebookContent;

  // required structures
  if (
    !('metadata' in notebook) ||
    !('nbformat_minor' in notebook) ||
    !('nbformat' in notebook) ||
    !('cells' in notebook)
  ) {
    return false;
  }

  // required properties
  if (
    typeof notebook.nbformat_minor !== 'number' ||
    typeof notebook.nbformat !== 'number' ||
    !Array.isArray(notebook.cells)
  ) {
    return false;
  }

  // cells
  if (!notebook.cells.every(cell => validateCell(cell))) {
    return false;
  }

  // metadata
  if (typeof notebook.metadata !== 'object' || notebook.metadata === null) {
    return false;
  }

  return true;
}

function validateCell(cell: ICell): boolean {
  return isCode(cell) || isMarkdown(cell) || isRaw(cell);
}
