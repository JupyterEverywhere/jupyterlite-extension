import { NotebookPanel } from '@jupyterlab/notebook';

export const KERNEL_URL_TO_NAME: Record<string, string> = {
  python: 'xpython',
  r: 'xr'
};

export const KERNEL_NAME_TO_URL: Record<string, string> = {
  xpython: 'python',
  xr: 'r'
};

export const KERNEL_DISPLAY_NAMES: Record<string, string> = {
  xpython: 'Python',
  xr: 'R'
};

/**
 * Switch the notebook's kernel if it differs from the desired one.
 * @param panel The NotebookPanel to operate on
 * @param desiredKernel The kernel name to switch to (e.g. "python", "xr")
 */
export async function switchKernel(panel: NotebookPanel, desiredKernel: string): Promise<void> {
  const currentKernel = panel.sessionContext.session?.kernel?.name;
  if (currentKernel === desiredKernel) {
    console.log(`Already on kernel: ${desiredKernel}. Skipping switch.`);
    return;
  }
  await panel.sessionContext.changeKernel({ name: desiredKernel });
  console.log(`Switched to kernel: ${desiredKernel}.`);
}
