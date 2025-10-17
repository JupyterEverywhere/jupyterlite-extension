| <img src="style/icons/logo.svg" alt="Jupyter Everywhere Logo" width="120" height="120"> | # Jupyter Everywhere<br><br>## A JupyterLite extension for K-12 education<br><br>Jupyter Everywhere is a notebooks-based application for K-12 education, designed to provide a simplified and user-friendly interface for students and educators. The platform runs entirely in web browsers without requiring any installation, making computational education accessible to students and teachers across all devices and operating systems.<br><br>This repository hosts the source code for the JupyterLite extension that powers Jupyter Everywhere. |
|---|---|

<div align="center">

[![Build Status]][build-link]
[![License]][license-link]
[![Try Jupyter Everywhere]][jupytereverywhere-link]

[Build Status]: https://img.shields.io/github/actions/workflow/status/JupyterEverywhere/jupyterlite-extension/build.yml?branch=main&logo=github&label=build
[License]: https://img.shields.io/badge/license-BSD--3--Clause-blue.svg?logo=opensourceinitiative&logoColor=white
[Try Jupyter Everywhere]: https://img.shields.io/badge/try-jupytereverywhere.org-D8B8DC?labelColor=4A3087&logo=data:image/png;base64,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
[build-link]: https://github.com/JupyterEverywhere/jupyterlite-extension/actions/workflows/build.yml
[license-link]: https://github.com/JupyterEverywhere/jupyterlite-extension/blob/main/LICENSE
[jupytereverywhere-link]: https://jupytereverywhere.github.io/jupyterlite-extension/lab/index.html

</div>

---


## Requirements

This extension requires `jupyterlab==4.5.0a3`, and additional dependencies listed in `lite/requirements.txt`.

## Getting started

### For end users

No installation required! Simply visit [jupytereverywhere.github.io](https://jupytereverywhere.github.io/jupyterlite-extension/lab/index.html) to start using Jupyter Everywhere directly in your web browser.

### For developers

To install the extension for development purposes, execute:

```bash
pip install jupytereverywhere
```

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
