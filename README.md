# jupytereverywhere

[![Github Actions Status](https://github.com/JupyterEverywhere/jupyterlite-extension/workflows/Build/badge.svg)](https://github.com/JupyterEverywhere/jupyterlite-extension/actions/workflows/build.yml)
[![Try](https://img.shields.io/badge/try-preview-yellow)](https://jupytereverywhere.github.io/jupyterlite-extension/lab/index.html)

A Jupyter extension for k12 education

## Requirements

- JupyterLab == 4.5.0a3

## Install

To install the extension, execute:

```bash
pip install jupytereverywhere
```

## Uninstall

To remove the extension, execute:

```bash
pip uninstall jupytereverywhere
```

## Contributing

### Development install

Note: You will need NodeJS to build the extension package.

The `jlpm` command is JupyterLab's pinned version of
[yarn](https://yarnpkg.com/) that is installed with JupyterLab. You may use
`yarn` or `npm` in lieu of `jlpm` below.

```bash
# Clone the repo to your local environment
# Change directory to the jupytereverywhere directory
# Install package in development mode
pip install -e "."
# Link your development version of the extension with JupyterLab
jupyter labextension develop . --overwrite
# Rebuild extension Typescript source after making changes
jlpm build
```

You can watch the source directory and run JupyterLab at the same time in different terminals to watch for changes in the extension's source and automatically rebuild the extension.

```bash
# Watch the source directory in one terminal, automatically rebuilding when needed
jlpm watch
# Run JupyterLab in another terminal
jupyter lab
```

With the watch command running, every saved change will immediately be built locally and available in your running JupyterLab. Refresh JupyterLab to load the change in your browser (you may need to wait several seconds for the extension to be rebuilt).

By default, the `jlpm build` command generates the source maps for this extension to make it easier to debug using the browser dev tools. To also generate source maps for the JupyterLab core extensions, you can run the following command:

```bash
jupyter lab build --minimize=False
```

### Linting

To ensure the code follows the standard style and does not contain basic issues run:

```bash
jlpm lint
```

You can have it run on relevant files automatically before each `git` commit by installing [`pre-commit`](https://pre-commit.com/):

```bash
pip install pre-commit
pre-commit install
```

### Development uninstall

```bash
pip uninstall jupytereverywhere
```

In development mode, you will also need to remove the symlink created by `jupyter labextension develop`
command. To find its location, you can run `jupyter labextension list` to figure out where the `labextensions`
folder is located. Then you can remove the symlink named `jupytereverywhere` within that folder.

### Testing the extension

#### Frontend tests

This extension is using [Jest](https://jestjs.io/) for JavaScript code testing.

To execute them, execute:

```sh
jlpm
jlpm test
```

#### Integration tests

This extension uses [Playwright](https://playwright.dev/docs/intro) for the integration tests (aka user level tests).

More information are provided within the [ui-tests](./ui-tests/README.md) README.

### Packaging the extension

See [RELEASE](RELEASE.md)
