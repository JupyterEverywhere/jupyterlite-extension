import { test, expect } from '@playwright/test';
import type { CommandRegistry } from '@lumino/commands';

declare global {
  interface Window {
    jupyterapp: CommandRegistry
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
