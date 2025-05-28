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

test.beforeEach(async ({ page }) => {
  await page.goto('lab/index.html');
  await page.waitForSelector('.jp-LabShell');
  const notebookName = 'Untitled.ipynb';
  const notebookExists = await page.getByText(notebookName).count();
  if (!notebookExists) {
    await runCommnad(page, 'docmanager:new-untitled', { type: 'notebook' });
  }
  await runCommnad(page, 'docmanager:open', { path: notebookName });
});

test.describe('General', () => {
  test('Should load the notebook', async ({ page }) => {
    expect(
      await page.locator('.jp-LabShell').screenshot({
        mask: [page.locator('.jp-KernelStatus')],
        maskColor: '#888888'
      })
    ).toMatchSnapshot('application-shell.png');
  });
});

test.describe('Sharing', () => {
  test('Should open share dialog', async ({ page }) => {
    const shareButton = page.locator('.jp-ToolbarButton').getByTitle('Share this notebook');
    await shareButton.click();
    const dialog = page.locator('.jp-Dialog-content');
    expect(
      await dialog.screenshot({
        mask: [dialog.locator('input#notebook-name'), dialog.locator('input#password')],
        maskColor: '#888888'
      })
    ).toMatchSnapshot('share-dialog.png');
  });
});

test.describe('Download', () => {
  test('Should open download Menu', async ({ page }) => {
    const downloadButton = page.locator('.je-DownloadButton');
    await downloadButton.click();
    expect(await page.locator('.jp-DownloadDropdownButton-menu').screenshot()).toMatchSnapshot(
      'download-menu.png'
    );
  });
});
