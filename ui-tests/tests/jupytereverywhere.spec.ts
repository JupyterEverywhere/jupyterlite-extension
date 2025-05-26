import { test, expect } from '@playwright/test';
import type { JupyterLab } from '@jupyterlab/application';

declare global {
  interface Window {
    jupyterapp: JupyterLab
  }
}

test.describe('General', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('lab/index.html');
  });
  test('Should load the app', async ({ page }) => {
    await page.evaluate(async () => {
      await window.jupyterapp.commands.execute('docmanager:new-untitled', { type: 'notebook' });
    });
    const nbPanel = page.locator('.jp-NotebookPanel');
    expect(await nbPanel.screenshot()).toMatchSnapshot('empty-notebook.png');
  });
});
