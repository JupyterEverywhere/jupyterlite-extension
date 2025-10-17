import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import os from 'os';
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

async function createTempNotebookFile(notebook: JSONObject, filename: string): Promise<string> {
  const tempPath = path.join(os.tmpdir(), filename);
  await fs.promises.writeFile(tempPath, JSON.stringify(notebook, null, 2));
  return tempPath;
}

const PYTHON_TEST_NOTEBOOK: JSONObject = {
  cells: [
    {
      cell_type: 'code',
      execution_count: null,
      id: '55eb9a2d-401d-4abd-b0eb-373ded5b408d',
      outputs: [],
      metadata: {
        sharedId: 'some-random-alphanumeric-id',
        readableId: 'python-test-notebook',
        sharedName: 'Notebook_1980-10-30_00-10-20',
        lastShared: '2024-06-20T00:10:20.123Z'
      },
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

const CLOJURE_TEST_NOTEBOOK: JSONObject = {
  cells: [
    {
      cell_type: 'code',
      execution_count: null,
      id: 'clojure-test-cell',
      outputs: [],
      metadata: {},
      source: [`; This is a Clojure test notebook`]
    }
  ],
  metadata: {
    kernelspec: {
      display_name: 'Clojure (irony)',
      language: 'Clojure',
      name: 'iclojure'
    },
    language_info: {
      file_extension: '.clj',
      mimetype: 'text/x-clojure',
      name: 'Clojure'
    }
  },
  nbformat: 4,
  nbformat_minor: 5
};

const VERY_LONG_CODE = 'A'.repeat(10000000);

const LARGE_TEST_NOTEBOOK: JSONObject = {
  cells: [
    {
      cell_type: 'code',
      execution_count: null,
      id: 'large-test-cell',
      outputs: [],
      metadata: {},
      source: [VERY_LONG_CODE]
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

async function mockShareNotebookTooLarge(page: Page) {
  await page.route('**/api/v1/notebooks', async route => {
    await route.fulfill({ status: 413, body: 'This is too large' });
  });
}

async function mockShareNotebookServerFailure(page: Page) {
  await page.route('**/api/v1/notebooks', async route => {
    await route.fulfill({ status: 500 });
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

  test('Should display a nice error if notebook server rejects as too large', async ({ page }) => {
    await mockTokenRoute(page);
    await mockShareNotebookTooLarge(page);
    await runCommand(page, 'jupytereverywhere:save-and-share');
    const dialog = page.locator('.jp-Dialog-content');
    expect(await dialog.screenshot()).toMatchSnapshot('share-dialog-failed-server-413.png');
  });

  test('Should display a nice error if notebook is too large and server is misbehaving', async ({
    page
  }) => {
    test.setTimeout(120_000);
    await mockTokenRoute(page);

    await page.waitForSelector('.jp-KernelStatus-success');

    // Generate a large notebook
    const cell = page.locator('.jp-Cell').last();
    await cell.getByRole('textbox').fill(VERY_LONG_CODE);

    await mockShareNotebookServerFailure(page);
    await runCommand(page, 'jupytereverywhere:save-and-share');
    const dialog = page.locator('.jp-Dialog-content');
    expect(await dialog.screenshot()).toMatchSnapshot(
      'share-dialog-failed-server-unkown-but-large.png'
    );
  });

  test('Clicking the Save button should trigger share dialog in editable notebook', async ({
    page
  }) => {
    await mockTokenRoute(page);
    await mockShareNotebookResponse(page, 'e3b0c442-98fc-1fc2-9c9f-8b6d6ed08a1d');

    const saveButton = page.locator(
      '.jp-NotebookPanel-toolbar [data-jp-item-name="save"] .jp-ToolbarButtonComponent'
    );
    await saveButton.click();

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

  test('Notebook downloaded as IPyNB should not have sharing-specific metadata', async ({
    page,
    context
  }) => {
    await mockTokenRoute(page);
    await mockShareNotebookResponse(page, 'test-download-metadata-notebook');

    const ipynbDownload = page.waitForEvent('download');
    await runCommand(page, 'jupytereverywhere:download-notebook');
    const ipynbPath = await (await ipynbDownload).path();
    expect(ipynbPath).not.toBeNull();

    const content = await fs.promises.readFile(ipynbPath!, { encoding: 'utf-8' });
    const notebook = JSON.parse(content) as JSONObject;
    const metadata = notebook['metadata'] as JSONObject | undefined;
    expect(metadata).toBeDefined();
    expect(metadata).not.toHaveProperty('sharedId');
    expect(metadata).not.toHaveProperty('readableId');
    expect(metadata).not.toHaveProperty('sharedName');
    expect(metadata).not.toHaveProperty('lastShared');
  });
});

// We take a screenshot of the full files page, to
// see that the sidebar shows "Files" as active.
test.describe('Files', () => {
  test('Should load Files page directly', async ({ page }) => {
    await page.goto('lab/files/');
    expect(await page.locator('.jp-LabShell').screenshot()).toMatchSnapshot('files-full.png');
    await expect(page).toHaveURL(/\/lab\/files\/$/);
  });

  test('Should upload three files and display their thumbnails', async ({ page }) => {
    await page.locator('.jp-SideBar').getByTitle('Files').click();

    await page.locator('.je-FileTile').first().click(); // the first tile will always be the "add new" one

    const jpgPath = path.resolve(__dirname, '../test-files/a-image.jpg');
    const csvPath = path.resolve(__dirname, '../test-files/b-dataset.csv');
    const webpPath = path.resolve(__dirname, '../test-files/c-flower.webp');

    await page.setInputFiles('input[type="file"]', [jpgPath, csvPath, webpPath]);

    // Wait some time for thumbnails to appear as the files
    // are being uploaded to the contents manager
    await page
      .locator('.je-FileTile-label', { hasText: 'a-image.jpg' })
      .waitFor({ state: 'visible' });
    await page
      .locator('.je-FileTile-label', { hasText: 'b-dataset.csv' })
      .waitFor({ state: 'visible' });
    await page
      .locator('.je-FileTile-label', { hasText: 'c-flower.webp' })
      .waitFor({ state: 'visible' });

    expect(await page.locator('.je-FilesApp-grid').screenshot()).toMatchSnapshot(
      'uploaded-files-grid.png'
    );

    await expect(page.locator('.je-FileTile-label', { hasText: 'a-image.jpg' })).toBeVisible();
    await expect(page.locator('.je-FileTile-label', { hasText: 'b-dataset.csv' })).toBeVisible();
    await expect(page.locator('.je-FileTile-label', { hasText: 'c-flower.webp' })).toBeVisible();
  });

  test('Clicking ellipsis shows dropdown menu with actions', async ({ page }) => {
    await page.locator('.jp-SideBar').getByTitle('Files').click();

    await page.locator('.je-FileTile').first().click();
    const jpgPath = path.resolve(__dirname, '../test-files/a-image.jpg');
    await page.setInputFiles('input[type="file"]', jpgPath);

    const tile = page.locator('.je-FileTile', {
      has: page.locator('.je-FileTile-label', { hasText: 'a-image.jpg' })
    });
    await tile.waitFor();

    // Click the ellipsis to open the menu
    const ellipsisButton = tile.locator('.je-FileMenu-trigger');
    await ellipsisButton.click();

    // Check that the dropdown menu is visible
    const dropdown = page.locator('.je-FileMenu-dropdown');
    await expect(dropdown).toBeVisible();
    await expect(dropdown.locator('.je-FileMenu-item', { hasText: 'Rename' })).toBeVisible();
    await expect(dropdown.locator('.je-FileMenu-item', { hasText: 'Download' })).toBeVisible();
    await expect(dropdown.locator('.je-FileMenu-item', { hasText: 'Delete' })).toBeVisible();

    await page.addStyleTag({
      content: '.je-FileMenu-dropdown { box-shadow: none !important; }'
    });

    expect(await dropdown.screenshot()).toMatchSnapshot('file-menu-dropdown.png');
  });

  test('Clicking Delete in the menu deletes the file tile', async ({ page }) => {
    await page.locator('.jp-SideBar').getByTitle('Files').click();

    await page.locator('.je-FileTile').first().click();
    const jpgPath = path.resolve(__dirname, '../test-files/a-image.jpg');
    await page.setInputFiles('input[type="file"]', jpgPath);

    const label = page.locator('.je-FileTile-label', { hasText: 'a-image.jpg' });
    await label.waitFor({ state: 'visible' });

    const tile = page.locator('.je-FileTile', { has: label });

    // Click ellipsis to open menu
    await tile.locator('.je-FileMenu-trigger').click();

    // Click Delete button in dropdown
    const dropdown = page.locator('.je-FileMenu-dropdown');
    await dropdown.locator('.je-FileMenu-item', { hasText: 'Delete' }).click();

    await expect(label).toHaveCount(0);
  });

  test('Clicking Download in the menu downloads the file', async ({ page }) => {
    await page.locator('.jp-SideBar').getByTitle('Files').click();

    await page.locator('.je-FileTile').first().click();
    const csvPath = path.resolve(__dirname, '../test-files/b-dataset.csv');
    await page.setInputFiles('input[type="file"]', csvPath);

    const label = page.locator('.je-FileTile-label', { hasText: 'b-dataset.csv' });
    await label.waitFor({ state: 'visible' });

    const tile = page.locator('.je-FileTile', { has: label });

    // Click ellipsis to open menu
    await tile.locator('.je-FileMenu-trigger').click();

    // Click Download button in dropdown
    const dropdown = page.locator('.je-FileMenu-dropdown');
    const downloadPromise = page.waitForEvent('download');
    await dropdown.locator('.je-FileMenu-item', { hasText: 'Download' }).click();
    const download = await downloadPromise;

    const filePath = await download.path();
    expect(filePath).not.toBeNull();
  });

  test('Should rename a file successfully', async ({ page }) => {
    await page.locator('.jp-SideBar').getByTitle('Files').click();

    await page.locator('.je-FileTile').first().click();
    const jpgPath = path.resolve(__dirname, '../test-files/a-image.jpg');
    await page.setInputFiles('input[type="file"]', jpgPath);

    const oldLabel = page.locator('.je-FileTile-label', { hasText: 'a-image.jpg' });
    await oldLabel.waitFor({ state: 'visible' });

    const tile = page.locator('.je-FileTile', { has: oldLabel });

    // Click ellipsis to open menu
    await tile.locator('.je-FileMenu-trigger').click();

    // Click Rename button and fill in new name

    await page.locator('.je-FileMenu-item', { hasText: 'Rename' }).click();

    const input = page.locator('#je-rename-input');
    await input.fill('renamed-image');

    // Click the button in the rename dialog
    await page.locator('.jp-Dialog-button', { hasText: 'Rename' }).click();

    const newLabel = page.locator('.je-FileTile-label', { hasText: 'renamed-image.jpg' });
    await expect(newLabel).toBeVisible();
    await expect(oldLabel).toHaveCount(0);
  });

  test('Should raise an error when renaming a file to an existing file name', async ({ page }) => {
    await page.locator('.jp-SideBar').getByTitle('Files').click();

    // Upload two files
    await page.locator('.je-FileTile').first().click();
    const jpgPath = path.resolve(__dirname, '../test-files/a-image.jpg');
    const csvPath = path.resolve(__dirname, '../test-files/d-leiria.jpg');
    await page.setInputFiles('input[type="file"]', [jpgPath, csvPath]);

    await page
      .locator('.je-FileTile-label', { hasText: 'a-image.jpg' })
      .waitFor({ state: 'visible' });
    await page
      .locator('.je-FileTile-label', { hasText: 'd-leiria.jpg' })
      .waitFor({ state: 'visible' });

    // Try to rename first file to second file's name
    const firstTile = page.locator('.je-FileTile', {
      has: page.locator('.je-FileTile-label', { hasText: 'a-image.jpg' })
    });

    await firstTile.locator('.je-FileMenu-trigger').click();
    await page.locator('.je-FileMenu-item', { hasText: 'Rename' }).click();

    const input = page.locator('#je-rename-input');
    await input.fill('d-leiria.jpg');

    await page.locator('.jp-Dialog-button', { hasText: 'Rename' }).click();

    // Check that the error dialog appears
    const errorDialog = page.locator('.jp-Dialog-content');
    await expect(errorDialog).toBeVisible();
    await expect(errorDialog).toContainText('File exists');

    expect(await errorDialog.screenshot()).toMatchSnapshot('rename-conflict-error.png');
  });

  test('Should show error when renaming with invalid characters', async ({ page }) => {
    await page.locator('.jp-SideBar').getByTitle('Files').click();

    await page.locator('.je-FileTile').first().click();
    const jpgPath = path.resolve(__dirname, '../test-files/a-image.jpg');
    await page.setInputFiles('input[type="file"]', jpgPath);

    const label = page.locator('.je-FileTile-label', { hasText: 'a-image.jpg' });
    await label.waitFor({ state: 'visible' });

    const tile = page.locator('.je-FileTile', { has: label });

    await tile.locator('.je-FileMenu-trigger').click();
    await page.locator('.je-FileMenu-item', { hasText: 'Rename' }).click();

    const input = page.locator('#je-rename-input');
    await input.fill('invalid/name');

    await page.locator('.jp-Dialog-button', { hasText: 'Rename' }).click();

    // Check that the error dialog appears
    const errorDialog = page.locator('.jp-Dialog-content');
    await expect(errorDialog).toBeVisible();
    await expect(errorDialog).toContainText('Invalid name');
    await expect(errorDialog).toContainText('cannot contain');
  });

  test('Should prevent changing file extension', async ({ page }) => {
    await page.locator('.jp-SideBar').getByTitle('Files').click();

    await page.locator('.je-FileTile').first().click();
    const jpgPath = path.resolve(__dirname, '../test-files/a-image.jpg');
    await page.setInputFiles('input[type="file"]', jpgPath);

    const label = page.locator('.je-FileTile-label', { hasText: 'a-image.jpg' });
    await label.waitFor({ state: 'visible' });

    const tile = page.locator('.je-FileTile', { has: label });

    await tile.locator('.je-FileMenu-trigger').click();
    await page.locator('.je-FileMenu-item', { hasText: 'Rename' }).click();

    const input = page.locator('#je-rename-input');
    await input.fill('changed-extension.png');

    await page.locator('.jp-Dialog-button', { hasText: 'Rename' }).click();

    // Check that error dialog appears
    const errorDialog = page.locator('.jp-Dialog-content');
    await expect(errorDialog).toBeVisible();
    await expect(errorDialog).toContainText('Cannot change file extension');
    await expect(errorDialog).toContainText('Jupyter Everywhere does not support');
  });

  test('Should show conflict dialog with multiple files when uploading files with existing names', async ({
    page
  }) => {
    await page.locator('.jp-SideBar').getByTitle('Files').click();

    // Upload two files
    const jpgPath = path.resolve(__dirname, '../test-files/a-image.jpg');
    const csvPath = path.resolve(__dirname, '../test-files/b-dataset.csv');

    await page.locator('.je-FileTile').first().click();
    await page.setInputFiles('input[type="file"]', [jpgPath, csvPath]);

    await page
      .locator('.je-FileTile-label', { hasText: 'a-image.jpg' })
      .waitFor({ state: 'visible' });
    await page
      .locator('.je-FileTile-label', { hasText: 'b-dataset.csv' })
      .waitFor({ state: 'visible' });

    // Try to upload the same files again
    await page.locator('.je-FileTile').first().click();
    await page.setInputFiles('input[type="file"]', [jpgPath, csvPath]);

    // Check that conflict dialog appears with multiple files listed
    const dialog = page.locator('.jp-Dialog-content');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Files already exist');
    await expect(dialog).toContainText('a-image.jpg');
    await expect(dialog).toContainText('b-dataset.csv');

    expect(await dialog.screenshot()).toMatchSnapshot('upload-conflict-multiple-dialog.png');
  });

  test('Should upload non-conflicting files when some files have conflicts', async ({ page }) => {
    await page.locator('.jp-SideBar').getByTitle('Files').click();

    // Upload first file
    const jpgPath = path.resolve(__dirname, '../test-files/a-image.jpg');
    await page.locator('.je-FileTile').first().click();
    await page.setInputFiles('input[type="file"]', jpgPath);

    await page
      .locator('.je-FileTile-label', { hasText: 'a-image.jpg' })
      .waitFor({ state: 'visible' });

    // Try to upload the same file along with a new file
    const csvPath = path.resolve(__dirname, '../test-files/b-dataset.csv');
    await page.locator('.je-FileTile').first().click();
    await page.setInputFiles('input[type="file"]', [jpgPath, csvPath]);

    // First dialog: conflict notification
    const conflictDialog = page.locator('.jp-Dialog-content');
    await expect(conflictDialog).toBeVisible();
    await conflictDialog.locator('button', { hasText: 'Close' }).click();

    // Second dialog: asking about remaining files
    const remainingDialog = page.locator('.jp-Dialog-content');
    await expect(remainingDialog).toBeVisible();
    await expect(remainingDialog).toContainText('Upload remaining files');
    await remainingDialog.locator('button', { hasText: 'Upload' }).click();

    // Check that the new file was uploaded
    await expect(page.locator('.je-FileTile-label', { hasText: 'b-dataset.csv' })).toBeVisible();
  });

  test('Should auto-append extension when renaming without extension', async ({ page }) => {
    await page.locator('.jp-SideBar').getByTitle('Files').click();

    await page.locator('.je-FileTile').first().click();
    const jpgPath = path.resolve(__dirname, '../test-files/a-image.jpg');
    await page.setInputFiles('input[type="file"]', jpgPath);

    const oldLabel = page.locator('.je-FileTile-label', { hasText: 'a-image.jpg' });
    await oldLabel.waitFor({ state: 'visible' });

    const tile = page.locator('.je-FileTile', { has: oldLabel });

    await tile.locator('.je-FileMenu-trigger').click();
    await page.locator('.je-FileMenu-item', { hasText: 'Rename' }).click();

    // Enter name without extension
    const input = page.locator('#je-rename-input');
    await input.fill('my-photo');

    await page.locator('.jp-Dialog-button', { hasText: 'Rename' }).click();

    // Check that extension was auto-appended
    const newLabel = page.locator('.je-FileTile-label', { hasText: 'my-photo.jpg' });
    await expect(newLabel).toBeVisible();
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

    // Override the hero section's height so that we don't get blank sections
    // after the viewport.
    await page.addStyleTag({
      content: '.je-hero { min-height: auto !important; height: auto !important; }'
    });

    // Find the scroll height because the landing page is long and we want to
    // capture the full page screenshot without the rest of it being empty; as
    // we use a viewport to handle the hero section.
    const scrollHeight = await page.evaluate(() => document.body.scrollHeight);

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

  test('Uploading a Python notebook redirects to JupyterLite', async ({ page }) => {
    await page.goto('index.html');

    const notebookPath = await createTempNotebookFile(PYTHON_TEST_NOTEBOOK, 'python-test.ipynb');

    await page.setInputFiles('input[type="file"]', notebookPath);

    await page.waitForURL(/lab\/index\.html\?uploaded-notebook=.*/);
    await page.waitForSelector('.jp-NotebookPanel');
  });

  test('Uploading an R notebook redirects to JupyterLite', async ({ page }) => {
    await page.goto('index.html');

    const notebookPath = await createTempNotebookFile(R_TEST_NOTEBOOK, 'r-test.ipynb');

    await page.setInputFiles('input[type="file"]', notebookPath);

    await page.waitForURL(/lab\/index\.html\?uploaded-notebook=.*/);
    await page.waitForSelector('.jp-NotebookPanel');
  });

  test('Uploading an unsupported notebook shows an error dialog', async ({ page }) => {
    await page.goto('index.html');

    const notebookPath = await createTempNotebookFile(CLOJURE_TEST_NOTEBOOK, 'clojure-test.ipynb');

    const dialog = page.locator('.jp-Dialog-content');
    await page.setInputFiles('input[type="file"]', notebookPath);

    await expect(dialog).toBeVisible();
    const content = await dialog.textContent();
    await expect(content).toContain('Only Python and R notebooks are supported');
    expect(await dialog.screenshot()).toMatchSnapshot('upload-error-dialog-not-supported.png');
  });

  test('Uploading a notebook larger than local storage can handle shows a nice dialog', async ({
    page
  }) => {
    await page.goto('index.html');

    const notebookPath = await createTempNotebookFile(LARGE_TEST_NOTEBOOK, 'large_test.ipynb');

    const dialog = page.locator('.jp-Dialog-content');
    await page.setInputFiles('input[type="file"]', notebookPath);

    expect(await dialog.screenshot()).toMatchSnapshot('upload-error-dialog-notebook-too-large.png');
  });
});

test.describe('Kernel Switching', () => {
  test('Should open kernel switcher menu', async ({ page }) => {
    const dropdownButton = page.locator('.je-KernelSwitcherButton');
    await dropdownButton.click();
    expect(
      await page.locator('.je-KernelSwitcherDropdownButton-menu').screenshot()
    ).toMatchSnapshot('kernel-switcher-menu.png');
  });
});

test('Should switch to R kernel and run R code', async ({ page }) => {
  await page.goto('lab/index.html');
  await page.waitForSelector('.jp-NotebookPanel');

  await runCommand(page, 'jupytereverywhere:switch-kernel', { kernel: 'xr' });
  await page.waitForTimeout(10000);
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

test.describe('Kernel networking', () => {
  const remoteUrl =
    'https://raw.githubusercontent.com/JupyterEverywhere/jupyterlite-extension/refs/heads/main/ui-tests/test-files/b-dataset.csv';
  const expectedContent = 'col1';

  test('R kernel should be able to fetch from a remote URL', async ({ page }) => {
    await page.goto('lab/index.html?kernel=r');
    await page.waitForSelector('.jp-NotebookPanel');

    const code = `read.csv("${remoteUrl}")`;
    const cell = page.locator('.jp-Cell').last();
    await cell.getByRole('textbox').fill(code);

    await runCommand(page, 'notebook:run-cell');

    const output = cell.locator('.jp-Cell-outputArea');
    await expect(output).toBeVisible({
      timeout: 20000 // shouldn't take too long to run but just to be safe
    });

    const text = await output.textContent();
    expect(text).toContain(expectedContent);
  });
  test('Python kernel should be able to fetch from a remote URL', async ({ page }) => {
    await page.goto('lab/index.html?kernel=python');
    await page.waitForSelector('.jp-NotebookPanel');

    const code = `import pandas; pandas.read_csv("${remoteUrl}")`;
    const cell = page.locator('.jp-Cell').last();
    await cell.getByRole('textbox').fill(code);

    await runCommand(page, 'notebook:run-cell');

    const output = cell.locator('.jp-Cell-outputArea');
    await expect(output).toBeVisible({
      timeout: 20000 // shouldn't take too long to run but just to be safe
    });

    const text = await output.textContent();
    expect(text).toContain(expectedContent);
  });
});

test.describe('Leave confirmation', () => {
  test('Leave confirmation snapshot', async ({ page }) => {
    await mockTokenRoute(page);
    await page.goto('lab/index.html');
    await page.waitForSelector('.jp-NotebookPanel');

    // Make the notebook dirty so the leave confirmation is shown
    const firstCell = page.locator('.jp-Cell').first();
    await firstCell.getByRole('textbox').fill('print("hello from a non-empty notebook")');

    const jeButton = page.locator('.jp-SideBar').getByTitle('Jupyter Everywhere');
    await jeButton.click();

    const dialog = page.locator('.jp-Dialog');
    await expect(dialog).toBeVisible();
    await page.waitForSelector('.jp-KernelStatus-success');
    expect(await dialog.screenshot()).toMatchSnapshot('leave-confirmation-dialog.png');
  });

  test('Should not show leave confirmation for empty notebook and should navigate to landing directly', async ({
    page
  }) => {
    await mockTokenRoute(page);
    await page.goto('lab/index.html');
    await page.waitForSelector('.jp-NotebookPanel');

    const jeButton = page.locator('.jp-SideBar').getByTitle('Jupyter Everywhere');
    const nav = page.waitForURL(/\/index\.html$/);
    await jeButton.click();
    await nav;

    await expect(page.locator('.je-hero')).toBeVisible();
    await expect(page.locator('.jp-Dialog')).toHaveCount(0);
  });

  test('When cancelled, should remain on the notebook view', async ({ page }) => {
    await mockTokenRoute(page);
    await page.goto('lab/index.html');
    await page.waitForSelector('.jp-NotebookPanel');

    // Make the notebook dirty so the leave confirmation is shown
    const firstCell = page.locator('.jp-Cell').first();
    await firstCell.getByRole('textbox').fill('x = 1');

    const jeButton = page.locator('.jp-SideBar').getByTitle('Jupyter Everywhere');
    await jeButton.click();

    const dialog = page.locator('.jp-Dialog');
    await expect(dialog).toBeVisible();

    await dialog.locator('.jp-Dialog-close-button').click();

    await expect(page.locator('.jp-NotebookPanel')).toBeVisible();
    await expect(dialog).toHaveCount(0);
  });

  test('Should accept and show share dialog, then redirect', async ({ page }) => {
    await mockTokenRoute(page);
    await mockShareNotebookResponse(page, 'test-redirect-notebook-id');
    await page.goto('lab/index.html');
    await page.waitForSelector('.jp-NotebookPanel');

    // Make the notebook dirty so the leave confirmation is shown
    const firstCell = page.locator('.jp-Cell').first();
    await firstCell.getByRole('textbox').fill('print("share me")');

    const jeButton = page.locator('.jp-SideBar').getByTitle('Jupyter Everywhere');
    await jeButton.click();

    const dialog = page.locator('.jp-Dialog');
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: 'Save and leave', exact: true }).click();

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
  test.describe.configure({ retries: 2 });
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

    // Wait for the kernel to initialise
    await page.waitForTimeout(10000);

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
    const promise = runCommand(page, 'notebook:restart-kernel');
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

test.describe('Placeholders in cells', () => {
  test.beforeEach(async ({ page }) => {
    await page.waitForSelector('.jp-NotebookPanel');
  });
  test('Code cell editor placeholder', async ({ page }) => {
    await runCommand(page, 'notebook:enter-command-mode');

    const cell = page.locator('.jp-CodeCell').first();
    expect(await cell.screenshot()).toMatchSnapshot('code-editor-placeholder.png');
  });
  test('Markdown cell editor placeholder', async ({ page }) => {
    await runCommand(page, 'notebook:change-cell-to-markdown');
    await runCommand(page, 'notebook:enter-command-mode');

    const cell = page.locator('.jp-MarkdownCell').first();
    expect(await cell.screenshot()).toMatchSnapshot('markdown-editor-placeholder.png');
  });
  test('Rendered Markdown cell placeholder', async ({ page }) => {
    await runCommand(page, 'notebook:change-cell-to-markdown');
    await runCommand(page, 'notebook:run-cell');

    const cell = page.locator('.jp-MarkdownCell').first();
    expect(await cell.screenshot()).toMatchSnapshot('rendered-markdown-placeholder.png');
  });
});

test.describe('Per cell run buttons', () => {
  test('Clicking the run button executes code and shows output', async ({ page }) => {
    await page.waitForSelector('.jp-NotebookPanel');

    const cell = page.locator('.jp-CodeCell').first();
    const editor = cell.getByRole('textbox');

    await editor.click(); // make it active so the run button is visible
    await editor.fill('print("hello from jupytereverywhere")');

    const runBtn = cell.locator('.je-cell-run-button');
    await expect(runBtn).toBeVisible();

    await runBtn.click();

    const output = cell.locator('.jp-Cell-outputArea');
    await expect(output).toBeVisible({ timeout: 20000 });
    await expect(output).toContainText('hello from jupytereverywhere', { timeout: 20000 });
  });

  test('Hides input execution count on hover/active', async ({ page }) => {
    await page.waitForSelector('.jp-NotebookPanel');

    // Ensure two cells so we can toggle active state cleanly, and
    // put some output in the first cell so it has an OutputPrompt.
    await runCommand(page, 'notebook:insert-cell-below');

    const firstCell = page.locator('.jp-CodeCell').first();
    const secondCell = page.locator('.jp-CodeCell').nth(1);

    await firstCell.getByRole('textbox').click();
    await firstCell.getByRole('textbox').fill('1+1');
    await firstCell.locator('.je-cell-run-button').click();
    await expect(firstCell.locator('.jp-Cell-outputArea')).toBeVisible({ timeout: 10000 });

    const inputIndicator = firstCell.locator('.jp-InputArea-prompt-indicator');

    // When the first cell is active, the input indicator should be hidden
    await firstCell.click();
    await expect(inputIndicator).toBeHidden();

    // Make another cell active, so the first is not active/selected
    await secondCell.click();
    await expect(inputIndicator).toBeVisible();

    // Hover over the first cell; input indicator should get hidden again
    await firstCell.hover();
    await expect(inputIndicator).toBeHidden();
  });

  test('For non-active/non-focused cells with an input execution count, there should not be an output execution count', async ({
    page
  }) => {
    await page.waitForSelector('.jp-NotebookPanel');

    // Ensure three cells so we can toggle active state cleanly.
    await runCommand(page, 'notebook:insert-cell-below');
    await runCommand(page, 'notebook:insert-cell-below');
    const firstCell = page.locator('.jp-CodeCell').first();
    const secondCell = page.locator('.jp-CodeCell').nth(1);
    const thirdCell = page.locator('.jp-CodeCell').nth(2);

    // Put some code in the first two cells and run them to get input
    // execution counts and an output prompt in the second cell.
    await firstCell.getByRole('textbox').click();
    await firstCell.getByRole('textbox').fill('x = 5');
    await firstCell.locator('.je-cell-run-button').click();

    await secondCell.getByRole('textbox').click();
    await secondCell.getByRole('textbox').fill('x');
    await secondCell.locator('.je-cell-run-button').click();

    // Go to the third cell so the first two are not active/focused
    await thirdCell.getByRole('textbox').click();

    // Wait for the execution counts to appear. Now, the second cell (inactive)
    // should have an input prompt, but no output prompt.
    const output = secondCell.locator('.jp-Cell-outputArea');
    await expect(output).toBeVisible({ timeout: 30000 });
    await expect(output).toContainText('5', { timeout: 30000 });

    const secondInputIndicator = secondCell.locator('.jp-InputPrompt');
    const secondOutputIndicator = secondCell.locator('.jp-OutputPrompt');
    await expect(secondInputIndicator).toBeVisible({ timeout: 10000 });
    await expect(secondOutputIndicator).toBeHidden({ timeout: 10000 });

    expect(
      await page.locator('.jp-LabShell').screenshot({
        mask: [page.locator('.jp-KernelStatus-widget')],
        maskColor: '#fff'
      })
    ).toMatchSnapshot('multiple-cells-prompt-indicators.png');
  });

  test('Run button is hidden on Raw cells and reappears on Code/Markdown cells', async ({
    page
  }) => {
    await page.waitForSelector('.jp-NotebookPanel');

    const cell = page.locator('.jp-Cell').first();
    const runBtn = cell.locator('.je-cell-run-button');

    await runCommand(page, 'notebook:change-cell-to-raw');
    await expect(runBtn).toBeHidden();

    await runCommand(page, 'notebook:change-cell-to-code');
    await cell.click();
    await expect(runBtn).toBeVisible();

    await runCommand(page, 'notebook:change-cell-to-markdown');
    await expect(runBtn).toBeVisible();
  });
});
