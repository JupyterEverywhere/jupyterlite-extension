import { expect, test } from '@jupyterlab/galata';

test.describe('General', () => {
  test('Should load the app', async ({ page }) => {
    await page.notebook.createNew('Test.ipynb');
    const nbPanel = await page.notebook.getNotebookInPanelLocator();
    expect(await nbPanel!.screenshot()).toMatchSnapshot('empty-notebook.png');
  });
});
