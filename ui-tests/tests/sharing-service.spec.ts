import { test, expect, Page } from '@playwright/test';
import type { JupyterLab } from '@jupyterlab/application';
import type { JSONObject } from '@lumino/coreutils';

declare global {
  interface Window {
    jupyterapp: JupyterLab;
  }
}

async function runCommand(page: Page, command: string, args: JSONObject = {}) {
  await page.evaluate(
    async ({ command, args }) => {
      await window.jupyterapp.commands.execute(command, args);
    },
    { command, args }
  );
}

const TEST_NOTEBOOK = {
  cells: [
    {
      cell_type: 'code',
      execution_count: null,
      id: 'test-cell-1',
      outputs: [],
      metadata: {},
      source: ['print("Hello from CKHub shared notebook!")']
    },
    {
      cell_type: 'markdown',
      id: 'test-cell-2',
      metadata: {},
      source: ['# Test Markdown Cell\n\nThis is a test notebook for sharing.']
    }
  ],
  metadata: {
    kernelspec: {
      display_name: 'Python 3 (ipykernel)',
      language: 'python',
      name: 'python3'
    },
    language_info: {
      name: 'python',
      version: '3.8.0'
    }
  },
  nbformat: 4,
  nbformat_minor: 5
};

async function createTestNotebook(page: Page): Promise<void> {
  await page.evaluate(notebookContent => {
    const { serviceManager } = window.jupyterapp;
    return serviceManager.contents.save('test-notebook.ipynb', {
      type: 'notebook',
      format: 'json',
      content: notebookContent
    });
  }, TEST_NOTEBOOK);
}

async function openTestNotebook(page: Page): Promise<void> {
  await runCommand(page, 'docmanager:open', { path: 'test-notebook.ipynb' });
}

async function extractShareUrlFromDialog(page: Page): Promise<string> {
  const shareUrlElement = await page.waitForSelector('.je-share-link', { timeout: 10000 });
  const shareUrl = await shareUrlElement.textContent();

  if (!shareUrl) {
    throw new Error('Share URL not found in dialog');
  }

  return shareUrl.trim();
}

async function getCellContent(page: Page, cellIndex: number = 0): Promise<string> {
  return await page.evaluate(index => {
    const cells = document.querySelectorAll('.jp-Cell');
    const cell = cells[index];
    if (!cell) return '';

    const content = cell.querySelector('.cm-content');
    return content?.textContent || '';
  }, cellIndex);
}

test.beforeEach(async ({ page }) => {
  await page.goto('lab/index.html');
  await page.waitForSelector('.jp-LabShell');
});

test.describe('A functional test for the sharing service', () => {
  test('Perform round-trip with sharing service', async ({ page, context }) => {
    await createTestNotebook(page);
    await openTestNotebook(page);
    await runCommand(page, 'jupytereverywhere:share-notebook');

    const shareUrl = await extractShareUrlFromDialog(page);

    const sharedPage = await context.newPage();
    await sharedPage.goto(shareUrl);
    await sharedPage.waitForSelector('.jp-LabShell');

    await runCommand(sharedPage, 'jupytereverywhere:create-copy-notebook');

    // Wait for view-only header to disappear
    await expect(sharedPage.locator('.je-ViewOnlyHeader')).toBeHidden({ timeout: 10000 });

    await sharedPage.close();
  });
});
