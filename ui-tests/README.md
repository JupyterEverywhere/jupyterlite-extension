# Integration Testing

This folder contains the integration tests for Jupyter Everywhere.

They are defined using [Playwright](https://playwright.dev/docs/intro) test runner.

The Playwright configuration is defined in [playwright.config.js](./playwright.config.js) file.

The default configuration will produce a video for failing tests and an HTML report.

There is a UI mode that you may like; see ["What's new in Playwright 1.32?"](https://www.youtube.com/watch?v=jF0yA-JLQW0).

## Writing tests

The primary way to interact with application in tests should be by Playwright-supported
actions on locators, such as `await page.locator('button').click()`.

For Jupyter-specific actions, the use of JupyterLab commands is encouraged. You may see the
[list of JupyterLab commands](https://jupyterlab.readthedocs.io/en/stable/user/commands.html#commands-list).

## Run the tests

All commands are assumed to be executed from the root directory.

To run the tests, you need to:

1. Install the extension in editable mode:

```sh
pip install -e .
```

2. Build the JupyterLite application:

```sh
cd ./lite
pip install -r requirements.txt  # needed only once
jlpm install
jlpm build:all
cd ..
```

3. Install test dependencies (needed only once):

```sh
cd ./ui-tests
jlpm install
jlpm playwright install
cd ..
```

4. Execute the [Playwright](https://playwright.dev/docs/intro) tests:

```sh
cd ./ui-tests
jlpm playwright test
```

To run a specific portion of the tests, you may use tags to match regular expressions.
For example, to run only the tests tagged with `sharing`:

```sh
cd ./ui-tests
jlpm playwright test -g "sharing"
```

More options are available; see the [Playwright documentation](https://playwright.dev/docs/test-cli)
and/or execute the `jlpm playwright test --help` command.

Test results will be shown in the terminal. In case of any test failures, the test report
will be opened in your browser at the end of the tests execution; see
[Playwright documentation](https://playwright.dev/docs/test-reporters#html-reporter)
for configuring that behavior.

## Update the tests snapshots

> All commands are assumed to be executed from the root directory

If you are comparing snapshots to validate your tests, you may need to update
the reference snapshots stored in the repository. To do that, you need to:

1. Install the extension in editable mode:

```sh
pip install -e .
```

2. Build JupyterLite application:

```sh
cd ./lite
pip install -r requirements.txt  # needed only once
jlpm install
jlpm build:all
cd ..
```

3. Install test dependencies (needed only once):

```sh
cd ./ui-tests
jlpm install
jlpm playwright install
cd ..
```

4. Execute the [Playwright](https://playwright.dev/docs/intro) command:

```sh
cd ./ui-tests
jlpm playwright test -u
```

> Some discrepancy may occurs between the snapshots generated on your computer and
> the one generated on the CI. To ease updating the snapshots on a PR, you can
> type `please update playwright snapshots` to trigger the update by a bot on the CI.
> Once the bot has computed new snapshots, it will commit them to the PR branch.

## Create tests

> All commands are assumed to be executed from the root directory

To create tests, the easiest way is to use the code generator tool of playwright:

1. Install the extension in editable mode:

```sh
pip install -e .
```

2. Build JupyterLite application:

```sh
cd ./lite
pip install -r requirements.txt  # needed only once
jlpm install
jlpm build:all
cd ..
```

3. Install test dependencies (needed only once):

```sh
cd ./ui-tests
jlpm install
jlpm playwright install
cd ..
```

4. Start the server:

```sh
cd ./ui-tests
jlpm start
```

5. Execute the [Playwright code generator](https://playwright.dev/docs/codegen) in **another terminal**:

```sh
cd ./ui-tests
jlpm playwright codegen localhost:3000
```

## Debug tests

> All commands are assumed to be executed from the root directory

To debug tests, a good way is to use the inspector tool of playwright:

1. Install the extension in editable mode:

```sh
pip install -e .
```

2. Build JupyterLite application:

```sh
cd ./lite
pip install -r requirements.txt  # needed only once
jlpm install
jlpm build:all
cd ..
```

3. Install test dependencies (needed only once):

```sh
cd ./ui-tests
jlpm install
jlpm playwright install
cd ..
```

4. Execute the Playwright tests in [debug mode](https://playwright.dev/docs/debug):

```sh
cd ./ui-tests
jlpm playwright test --debug
```

## Upgrade Playwright and the browsers

To update the web browser versions, you must update the package `@playwright/test`:

```sh
cd ./ui-tests
jlpm up "@playwright/test"
jlpm playwright install
```
