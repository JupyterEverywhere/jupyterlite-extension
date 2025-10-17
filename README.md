# The JupyterLite extension for Jupyter Everywhere

[![Github Actions Status](https://github.com/JupyterEverywhere/jupyterlite-extension/workflows/Build/badge.svg)](https://github.com/JupyterEverywhere/jupyterlite-extension/actions/workflows/build.yml)
[![Try](https://img.shields.io/badge/try-preview-yellow)](https://jupytereverywhere.github.io/jupyterlite-extension/lab/index.html)

Jupyter Everywhere is a JupyterLite application for K12 education, designed to provide a simplified and user-friendly interface for students and educators. This repository hosts the the JupyterLite extension that powers Jupyter Everywhere.

## Requirements

This extension requires `jupyterlab==4.5.0a3`, and additional dependencies listed in `lite/requirements.txt`.

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

If you'd like to contribute to Jupyter Everywhere (thanks!), please read the following instructions to set up your development environment.

### Development install

Note: You will need Node.js to build the extension package.

The `jlpm` command is JupyterLab's pinned version of
[yarn](https://yarnpkg.com/) that is installed with JupyterLab

```bash
# Clone the repo to your local environment
# Change directory to the jupytereverywhere directory
# Install package in development mode
pip install -e "."
# Link your development version of the extension with JupyterLab
jupyter labextension develop . --overwrite
# Rebuild the extension TypeScript source after making changes
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

To ensure that the code follows the standard style and does not contain basic issues, run:

```bash
jlpm lint
```

You can have it run on relevant files automatically before each `git` commit, by installing [`prek`](https://prek.j178.dev/),
which will use the configuration provided in the `.pre-commit-config.yaml` file and install the necessary hooks:

```bash
pip install prek
prek install
```

### Development uninstall

```bash
pip uninstall jupytereverywhere
```

In development mode, you will also need to remove the symlink created by `jupyter labextension develop`
command. To find its location, you can run `jupyter labextension list` to figure out where the `labextensions`
folder is located. You can then remove the symlink named `jupytereverywhere` within that folder.

### Testing the extension

This extension uses [Playwright](https://playwright.dev/docs/intro) for the integration (snapshot) tests.

More information is provided within the [the `ui-tests/README.md` document](ui-tests/README.md).

### Releases

See [RELEASE.md](RELEASE.md) for instructions on creating a new release of the extension and the bundled JupyterLite application.
