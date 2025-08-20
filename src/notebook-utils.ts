import type { INotebookContent, MultilineString } from '@jupyterlab/nbformat';

const toText = (src?: MultilineString): string => (Array.isArray(src) ? src.join('') : (src ?? ''));

/**
 * Iterates over all cells of a notebook and returns true the notebook has no meaningful
 * content. We consider a notebook "non-empty" if at least one cell has a populated
 * non-whitespace source.
 * @param nb - the notebook to check if it's empty
 * @returns - a boolean indicating whether the notebook is empty or not.
 */
export function isNotebookEmpty(nb?: Partial<INotebookContent>): boolean {
  const cells = nb?.cells ?? [];
  if (cells.length === 0) {
    return true;
  }

  for (const cell of cells) {
    if (/\S/.test(toText(cell?.source as MultilineString | undefined))) {
      return false;
    }
  }
  return true;
}
