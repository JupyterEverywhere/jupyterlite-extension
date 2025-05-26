import { test, expect, Page } from '@playwright/test';
import type { JupyterLab } from '@jupyterlab/application';
import type { JSONObject } from '@lumino/coreutils';

declare global {
  interface Window {
    jupyterapp: JupyterLab;
  }
}

async function runCommnad(page: Page, command: string, args: JSONObject = {}) {
  await page.evaluate(
    async ({ command, args }) => {
      await window.jupyterapp.commands.execute(command, args);
    },
    { command, args }
  );
}

test.describe('General', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('lab/index.html');
    await page.waitForSelector('.jp-LabShell');
  });
  test('Should load the notebook', async ({ page }) => {
    await runCommnad(page, 'docmanager:new-untitled', { type: 'notebook' });
    await runCommnad(page, 'docmanager:open', { path: 'Untitled.ipynb' });
    expect(await page.locator('.jp-LabShell').screenshot()).toMatchSnapshot(
      'application-shell.png'
    );
  });
});
