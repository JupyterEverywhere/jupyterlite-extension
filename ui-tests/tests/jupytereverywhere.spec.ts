import { expect, test } from '@jupyterlab/galata';

test.describe('General', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('lab/index.html');
  });
  test('Should load the app', async ({ page }) => {
    await page.evaluate(async () => {
      await window.jupyterapp.commands.execute('docmanager:new-untitled', { type: 'notebook' });
    });
    const nbPanel = await page.notebook.getNotebookInPanelLocator();
    expect(await nbPanel!.screenshot()).toMatchSnapshot('empty-notebook.png');
  });
});
