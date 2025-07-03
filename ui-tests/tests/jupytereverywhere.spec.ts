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
      id: '55eb9a2d-401d-4abd-b0eb-373ded5b408d',
      outputs: [],
      metadata: {},
      source: [`# This is a test notebook`]
    }
  ],
  metadata: {
    kernelspec: {
      display_name: 'Python 3 (ipykernel)',
      language: 'python',
      name: 'python3'
    },
    language_info: {
      codemirror_mode: {
        name: 'ipython',
        version: 3
      },
      file_extension: '.py',
      mimetype: 'text/x-python',
      name: 'python',
      nbconvert_exporter: 'python',
      pygments_lexer: 'ipython3'
    }
  },
  nbformat: 4,
  nbformat_minor: 5
};

async function mockTokenRoute(page: Page) {
  await page.route('**/api/v1/auth/issue', async route => {
    const json = { token: 'test-token' };
    await route.fulfill({ json });
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto('lab/index.html');
  await page.waitForSelector('.jp-LabShell');
});

test.describe('General', () => {
  test('Should load a notebook', async ({ page }) => {
    await page.waitForTimeout(1000);
    expect(
      await page.locator('.jp-LabShell').screenshot({
        mask: [page.locator('.jp-KernelStatus')],
        maskColor: '#888888'
      })
    ).toMatchSnapshot('application-shell.png');
  });

  test('Dialog windows should shade the notebook area only', async ({ page }) => {
    const promise = runCommand(page, 'notebook:restart-kernel');
    const dialog = page.locator('.jp-Dialog');

    expect(
      await dialog.screenshot({
        mask: [dialog.locator('.jp-Dialog-content')],
        maskColor: '#fff'
      })
    ).toMatchSnapshot('empty-dialog-over-notebook.png');

    // Close dialog
    dialog.press('Esc');
    await promise;
  });

  test('Should load a view-only notebook', async ({ page }) => {
    await mockTokenRoute(page);
    const notebookId = 'e3b0c442-98fc-1fc2-9c9f-8b6d6ed08a1d';

    await page.route('**/api/v1/notebooks/*', async route => {
      const json = {
        id: notebookId,
        domain_id: 'domain',
        readable_id: null,
        content: TEST_NOTEBOOK
      };
      await route.fulfill({ json });
    });

    await page.goto(`lab/index.html?notebook=${notebookId}`);

    expect(
      await page.locator('.jp-NotebookPanel').screenshot({
        mask: [page.locator('.jp-KernelStatus')],
        maskColor: '#888888'
      })
    ).toMatchSnapshot('read-only-notebook.png');
  });

  test('Should open files page', async ({ page }) => {
    await page.locator('.jp-SideBar').getByTitle('Files').click();
    expect(await page.locator('#je-files').screenshot()).toMatchSnapshot('files.png');
  });
});

test.describe('Sharing', () => {
  test('Should open share dialog', async ({ page }) => {
    await mockTokenRoute(page);
    await page.route('**/api/v1/notebooks', async route => {
      const json = {
        message: 'Shared!',
        notebook: { id: 'e3b0c442-98fc-1fc2-9c9f-8b6d6ed08a1d', readable_id: null }
      };
      await route.fulfill({ json });
    });
    const shareButton = page.locator('.jp-ToolbarButton').getByTitle('Share this notebook');
    await shareButton.click();
    const dialog = page.locator('.jp-Dialog-content');
    expect(await dialog.screenshot()).toMatchSnapshot('share-dialog.png');
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
