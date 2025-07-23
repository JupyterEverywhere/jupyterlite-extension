import { test, expect, Page } from '@playwright/test';
import path from 'path';
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
      window.jupyterapp.commands.execute(command, args);
    },
    { command, args }
  );
}

const PYTHON_TEST_NOTEBOOK: JSONObject = {
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
      display_name: 'Python 3.13 (XPython)',
      language: 'python',
      name: 'xpython'
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

const R_TEST_NOTEBOOK: JSONObject = {
  cells: [
    {
      cell_type: 'code',
      execution_count: null,
      id: 'r-test-cell',
      outputs: [],
      metadata: {},
      source: [`# This is an R test notebook`]
    }
  ],
  metadata: {
    kernelspec: {
      display_name: 'R (xr)',
      language: 'R',
      name: 'xr'
    },
    language_info: {
      codemirror_mode: 'r',
      file_extension: '.r',
      mimetype: 'text/x-r-source',
      name: 'R'
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

async function mockGetSharedNotebook(page: Page, notebookId: string, notebookContent: JSONObject) {
  await page.route('**/api/v1/notebooks/*', async route => {
    const json = {
      id: notebookId,
      domain_id: 'domain',
      readable_id: null,
      content: notebookContent
    };
    await route.fulfill({ json });
  });
}

async function mockShareNotebookResponse(page: Page, notebookId: string) {
  await page.route('**/api/v1/notebooks', async route => {
    const json = {
      message: 'Shared!',
      notebook: { id: notebookId, readable_id: null }
    };
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
        mask: [page.locator('.jp-KernelStatus-widget')],
        maskColor: '#fff'
      })
    ).toMatchSnapshot('application-shell.png');
  });

  test('Dialog windows should shade the notebook area only', async ({ page }) => {
    const firstCell = page.locator('.jp-Cell');
    await firstCell
      .getByRole('textbox')
      .fill('The shaded area should cover the notebook content, but not the toolbar.');
    const promise = runCommand(page, 'notebook:restart-kernel');
    const dialog = page.locator('.jp-Dialog');

    expect(
      await dialog.screenshot({
        mask: [dialog.locator('.jp-Dialog-content'), page.locator('.jp-KernelStatus-widget')],
        maskColor: '#fff'
      })
    ).toMatchSnapshot('empty-dialog-over-notebook.png');

    // Close dialog
    await dialog.press('Escape');
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
        content: PYTHON_TEST_NOTEBOOK
      };
      await route.fulfill({ json });
    });

    await page.goto(`lab/index.html?notebook=${notebookId}`);

    await page.waitForSelector('.jp-LabShell');

    expect(await page.locator('.jp-NotebookPanel').screenshot()).toMatchSnapshot(
      'read-only-notebook.png'
    );
  });

  test('Should open files page', async ({ page }) => {
    await page.locator('.jp-SideBar').getByTitle('Files').click();
    expect(await page.locator('#je-files').screenshot()).toMatchSnapshot('files.png');
  });

  test('Should open the help page', async ({ page }) => {
    await page.locator('.jp-SideBar').getByTitle('Help Centre').click();
    expect(await page.locator('#je-help').screenshot()).toMatchSnapshot('help.png');
  });
});

test.describe('Sharing', () => {
  test('Should open share dialog in interactive notebook', async ({ page }) => {
    await mockTokenRoute(page);
    await mockShareNotebookResponse(page, 'e3b0c442-98fc-1fc2-9c9f-8b6d6ed08a1d');
    const shareButton = page.locator('.jp-ToolbarButton').getByTitle('Share this notebook');
    await shareButton.click();
    const dialog = page.locator('.jp-Dialog-content');
    expect(await dialog.screenshot()).toMatchSnapshot('share-dialog.png');
  });

  test('Should open share dialog in view-only mode', async ({ page }) => {
    await mockTokenRoute(page);

    // Load view-only (shared) notebook
    const notebookId = 'e3b0c442-98fc-1fc2-9c9f-8b6d6ed08a1d';
    await mockGetSharedNotebook(page, notebookId, PYTHON_TEST_NOTEBOOK);
    await page.goto(`lab/index.html?notebook=${notebookId}`);

    // Re-Share it as a new notebook
    const newNotebookId = '104931f8-fd96-489e-8520-c1793cbba6ce';
    await mockShareNotebookResponse(page, newNotebookId);

    const shareButton = page.locator('.jp-ToolbarButton').getByTitle('Share this notebook');
    const dialog = page.locator('.jp-Dialog-content');
    await expect(dialog).toHaveCount(0);
    await shareButton.click();
    await expect(dialog).toHaveCount(1);
  });

  test('Should show share dialog on Accel+S in interactive notebook', async ({ page }) => {
    await mockTokenRoute(page);
    await mockShareNotebookResponse(page, 'e3b0c442-98fc-1fc2-9c9f-8b6d6ed08a1d');
    await runCommand(page, 'jupytereverywhere:save-and-share');
    const dialog = page.locator('.jp-Dialog-content');
    await expect(dialog).toBeVisible();
    expect(await dialog.screenshot()).toMatchSnapshot('share-dialog.png');
  });
});

test.describe('Download', () => {
  test('Should open download Menu', async ({ page }) => {
    const downloadButton = page.locator('.je-DownloadButton');
    await downloadButton.click();
    expect(await page.locator('.je-DownloadDropdownButton-menu').screenshot()).toMatchSnapshot(
      'download-menu.png'
    );
  });

  test('Should download a notebook as IPyNB and PDF', async ({ page, context }) => {
    await mockTokenRoute(page);
    await mockShareNotebookResponse(page, 'test-download-regular-notebook');

    const ipynbDownload = page.waitForEvent('download');
    await runCommand(page, 'jupytereverywhere:download-notebook');
    const ipynbPath = await (await ipynbDownload).path();
    expect(ipynbPath).not.toBeNull();

    const pdfDownload = page.waitForEvent('download');
    await runCommand(page, 'jupytereverywhere:download-pdf');
    const pdfPath = await (await pdfDownload).path();
    expect(pdfPath).not.toBeNull();
  });

  test('Should download view-only notebook as IPyNB and PDF', async ({ page }) => {
    await mockTokenRoute(page);

    const notebookId = 'e3b0c442-98fc-1fc2-9c9f-8b6d6ed08a1d';
    await mockGetSharedNotebook(page, notebookId, PYTHON_TEST_NOTEBOOK);
    await mockShareNotebookResponse(page, 'test-download-viewonly-notebook');

    await page.goto(`lab/index.html?notebook=${notebookId}`);

    // Wait until view-only notebook loads, and assert it is a view-only notebook.
    await page.locator('.jp-NotebookPanel').waitFor();
    await expect(page.locator('.je-ViewOnlyHeader')).toBeVisible();

    const ipynbDownload = page.waitForEvent('download');
    await runCommand(page, 'jupytereverywhere:download-pdf');
    const ipynbPath = await (await ipynbDownload).path();
    expect(ipynbPath).not.toBeNull();

    const pdfDownload = page.waitForEvent('download');
    await runCommand(page, 'jupytereverywhere:download-pdf');

    const pdfPath = await (await pdfDownload).path();
    expect(pdfPath).not.toBeNull();
  });
});

test.describe('Files', () => {
  test('Should upload two files and display their thumbnails', async ({ page }) => {
    await page.locator('.jp-SideBar').getByTitle('Files').click();

    await page.locator('.je-FileTile').first().click(); // the first tile will always be the "add new" one

    const jpgPath = path.resolve(__dirname, '../test-files/a-image.jpg');
    const csvPath = path.resolve(__dirname, '../test-files/b-dataset.csv');

    await page.setInputFiles('input[type="file"]', [jpgPath, csvPath]);

    // Wait some time for thumbnails to appear as the files
    // are being uploaded to the contents manager
    await page
      .locator('.je-FileTile-label', { hasText: 'a-image.jpg' })
      .waitFor({ state: 'visible' });
    await page
      .locator('.je-FileTile-label', { hasText: 'b-dataset.csv' })
      .waitFor({ state: 'visible' });

    expect(await page.locator('.je-FilesApp-grid').screenshot()).toMatchSnapshot(
      'uploaded-files-grid.png'
    );

    await expect(page.locator('.je-FileTile-label', { hasText: 'a-image.jpg' })).toBeVisible();
    await expect(page.locator('.je-FileTile-label', { hasText: 'b-dataset.csv' })).toBeVisible();
  });
});

test('Should remove View Only banner when the Create Copy button is clicked', async ({ page }) => {
  await mockTokenRoute(page);

  const notebookId = 'e3b0c442-98fc-1fc2-9c9f-8b6d6ed08a1d';
  await mockGetSharedNotebook(page, notebookId, PYTHON_TEST_NOTEBOOK);

  // Open view-only notebook
  await page.goto(`lab/index.html?notebook=${notebookId}`);
  await expect(page.locator('.je-ViewOnlyHeader')).toBeVisible();

  const createCopyButton = page.locator('.jp-ToolbarButtonComponent.je-CreateCopyButton');
  await createCopyButton.click();
  await expect(page.locator('.je-ViewOnlyHeader')).toBeHidden({
    timeout: 10000
  });

  // Check toolbar items typical of an editable notebook are present
  await expect(page.locator('.jp-NotebookPanel-toolbar [data-jp-item-name="save"]')).toBeVisible();
  await expect(
    page.locator('.jp-NotebookPanel-toolbar [data-jp-item-name="insert"]')
  ).toBeVisible();
});

test.describe('Landing page', () => {
  test.describe.configure({ retries: 2 });
  test('Should render the landing page as expected', async ({ page }) => {
    await page.goto('index.html');
    await page.waitForSelector('.je-hero');

    await page.waitForTimeout(2000);

    // Find the scroll height because the landing page is long and we want to
    // capture the full page screenshot without the rest of it being empty; as
    // we use a viewport to handle the hero section.
    const scrollHeight = await page.evaluate(() => document.body.scrollHeight);

    // Override the hero section's height so that we don't get blank sections
    // after the viewport.
    await page.addStyleTag({
      content: '.je-hero { min-height: auto !important; height: auto !important; }'
    });

    await page.setViewportSize({
      width: 1440,
      height: scrollHeight
    });

    const screenshot = await page.screenshot({
      fullPage: true
    });

    expect(screenshot).toMatchSnapshot('landing-page.png');
  });

  test('Clicking "Create Python Notebook" on the landing page opens a Python kernel', async ({
    page
  }) => {
    await page.goto('index.html');
    await page.click('a[href*="kernel=python"]');
    await page.waitForSelector('.jp-NotebookPanel');

    const kernelLabel = await page.locator('.je-KernelSwitcherButton').innerText();
    expect(kernelLabel.toLowerCase()).toContain('python');
  });

  test('Clicking "Create R Notebook" on the landing page opens an R kernel', async ({ page }) => {
    await page.goto('index.html');
    await page.click('a[href*="kernel=r"]');
    await page.waitForSelector('.jp-NotebookPanel');

    const kernelLabel = await page.locator('.je-KernelSwitcherButton').innerText();
    expect(kernelLabel.toLowerCase()).toContain('r');
  });
});

test.describe('Kernel Switching', () => {
  test('Should open kernel switcher menu', async ({ page }) => {
    const downloadButton = page.locator('.je-KernelSwitcherButton');
    await downloadButton.click();
    expect(
      await page.locator('.je-KernelSwitcherDropdownButton-menu').screenshot()
    ).toMatchSnapshot('kernel-switcher-menu.png');
  });
});

test('Should switch to R kernel and run R code', async ({ page }) => {
  await page.goto('lab/index.html');
  await page.waitForSelector('.jp-NotebookPanel');

  await runCommand(page, 'jupytereverywhere:switch-kernel', { kernel: 'xr' });
  await runCommand(page, 'notebook:insert-cell-below');

  const code = 'lm(mpg ~ wt + hp + disp + cyl, data=mtcars)';
  const cell = page.locator('.jp-Cell').last();
  await cell.getByRole('textbox').fill(code);

  await runCommand(page, 'notebook:run-cell');

  const output = cell.locator('.jp-Cell-outputArea');
  await expect(output).toBeVisible({
    timeout: 20000 // shouldn't take too long to run but just to be safe
  });

  const text = await output.textContent();
  expect(text).toContain('Call');
  // Add a snapshot of the output area
  expect(await output.screenshot()).toMatchSnapshot('r-output.png');
});

test.describe('Leave confirmation', () => {
  test('Leave confirmation snapshot', async ({ page }) => {
    await mockTokenRoute(page);
    await page.goto('lab/index.html');
    await page.waitForSelector('.jp-NotebookPanel');

    const jeButton = page.locator('.jp-SideBar').getByTitle('Jupyter Everywhere');
    await jeButton.click();

    const dialog = page.locator('.jp-Dialog');
    await expect(dialog).toBeVisible();
    await page.waitForSelector('.jp-KernelStatus-success');
    expect(await dialog.screenshot()).toMatchSnapshot('leave-confirmation-dialog.png');
  });

  test('When cancelled, should remain on the notebook view', async ({ page }) => {
    await mockTokenRoute(page);
    await page.goto('lab/index.html');
    await page.waitForSelector('.jp-NotebookPanel');

    const jeButton = page.locator('.jp-SideBar').getByTitle('Jupyter Everywhere');
    await jeButton.click();

    const dialog = page.locator('.jp-Dialog');
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: 'Cancel' }).click();

    await expect(page.locator('.jp-NotebookPanel')).toBeVisible();
    await expect(dialog).toHaveCount(0);
  });

  test('Should accept and show share dialog, then redirect', async ({ page }) => {
    await mockTokenRoute(page);
    await mockShareNotebookResponse(page, 'test-redirect-notebook-id');
    await page.goto('lab/index.html');
    await page.waitForSelector('.jp-NotebookPanel');

    const jeButton = page.locator('.jp-SideBar').getByTitle('Jupyter Everywhere');
    await jeButton.click();

    const dialog = page.locator('.jp-Dialog');
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: 'Yes' }).click();

    const shareDialog = page.locator('.jp-Dialog-content');
    await expect(shareDialog).toBeVisible();

    const copyButton = shareDialog.locator('button.jp-Dialog-button').first();
    await copyButton.click();

    // Wait for redirect to the landing page, and make
    // sure we're not on the notebook page anymore.
    await page.waitForSelector('.je-hero', { timeout: 5000 });

    await expect(page.locator('.jp-NotebookPanel')).toHaveCount(0);
  });
});

test.describe('Sharing and copying R and Python notebooks', () => {
  test('Should create copy from view-only R notebook and keep R kernel', async ({ page }) => {
    await mockTokenRoute(page);

    const notebookId = 'e3b0c442-98fc-1fc2-9c9f-8b6d6ed08a1d';
    await mockGetSharedNotebook(page, notebookId, R_TEST_NOTEBOOK);

    // Open view-only notebook
    await page.goto(`lab/index.html?notebook=${notebookId}`);
    await expect(page.locator('.je-ViewOnlyHeader')).toBeVisible();

    const createCopyButton = page.locator('.jp-ToolbarButtonComponent.je-CreateCopyButton');
    await createCopyButton.click();
    await expect(page.locator('.je-ViewOnlyHeader')).toBeHidden({
      timeout: 10000
    });

    // Wait for the notebook to switch to editable mode
    await page.waitForSelector('.jp-NotebookPanel');

    // Verify kernel is R
    const kernelLabel = await page.locator('.je-KernelSwitcherButton').innerText();
    expect(kernelLabel.toLowerCase()).toContain('r');
  });

  test('Should create copy from view-only Python notebook and keep Python kernel', async ({
    page
  }) => {
    await mockTokenRoute(page);

    const notebookId = 'e3b0c442-98fc-1fc2-9c9f-8b6d6ed08a1d';
    await mockGetSharedNotebook(page, notebookId, PYTHON_TEST_NOTEBOOK);

    // Open view-only notebook
    await page.goto(`lab/index.html?notebook=${notebookId}`);
    await expect(page.locator('.je-ViewOnlyHeader')).toBeVisible();

    const createCopyButton = page.locator('.jp-ToolbarButtonComponent.je-CreateCopyButton');
    await createCopyButton.click();
    await expect(page.locator('.je-ViewOnlyHeader')).toBeHidden({
      timeout: 10000
    });

    // Wait for the notebook to switch to editable mode
    await page.waitForSelector('.jp-NotebookPanel');

    // Verify kernel is Python
    const kernelLabel = await page.locator('.je-KernelSwitcherButton').innerText();
    expect(kernelLabel.toLowerCase()).toContain('python');
  });
});

test.describe('Kernel URL param behaviour', () => {
  test('Should remove kernel param when opening view-only notebook', async ({ page }) => {
    await mockTokenRoute(page);

    const notebookId = 'e3b0c442-98fc-1fc2-9c9f-8b6d6ed08a1d';
    await mockGetSharedNotebook(page, notebookId, PYTHON_TEST_NOTEBOOK);

    // Open view-only notebook
    await page.goto(`lab/index.html?notebook=${notebookId}`);
    await expect(page.locator('.je-ViewOnlyHeader')).toBeVisible();

    // Wait for kernel param to be stripped
    await page.waitForFunction(() => !new URL(window.location.href).searchParams.has('kernel'));

    const url = new URL(page.url());
    expect(url.searchParams.has('kernel')).toBe(false);
    expect(url.searchParams.get('notebook')).toBe(notebookId);
  });

  test('Should remove kernel param after kernel initializes', async ({ page }) => {
    await page.goto('lab/index.html?kernel=r');
    await page.waitForSelector('.jp-NotebookPanel');
    await page.waitForFunction(() => !new URL(window.location.href).searchParams.has('kernel'));

    const url = new URL(page.url());
    expect(url.searchParams.has('kernel')).toBe(false);
  });
});

test.describe('Title of the pages should be "Jupyter Everywhere"', () => {
  test('Landing page title', async ({ page }) => {
    await page.goto('index.html');
    const title = await page.title();
    expect(title).toBe('Jupyter Everywhere');
  });

  test('Notebook page title', async ({ page }) => {
    await page.goto('lab/index.html');
    const title = await page.title();
    expect(title).toBe('Jupyter Everywhere');
  });
});

test.describe('Kernel commands should use memory terminology', () => {
  test('Restart memory command', async ({ page }) => {
    const promise = runCommand(page, 'jupytereverywhere:restart-memory');
    const dialog = page.locator('.jp-Dialog-content');

    await expect(dialog).toBeVisible();
    expect(await dialog.screenshot()).toMatchSnapshot('restart-memory-dialog.png');

    await dialog.press('Escape');
    await promise;
  });

  test('Restart memory and run all cells command', async ({ page }) => {
    const promise = runCommand(page, 'jupytereverywhere:restart-and-run-all');
    const dialog = page.locator('.jp-Dialog-content');

    await expect(dialog).toBeVisible();
    expect(await dialog.screenshot()).toMatchSnapshot('restart-memory-run-all-dialog.png');

    await dialog.press('Escape');
    await promise;
  });
});
