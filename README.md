<table border="0">
  <tr>
    <td width="120" align="center" valign="middle" style="padding-right: 10px;">
      <img src="style/icons/logo.svg" alt="Jupyter Everywhere Logo" width="120" height="120">
    </td>
    <td valign="top">
      <h1>Jupyter Everywhere</h1>
      <h2>A JupyterLite extension for K-12 education</h2>
      <p>Jupyter Everywhere is a notebooks-based application for K-12 education, designed to provide a simplified and user-friendly interface for students and educators. The platform runs entirely in web browsers without requiring any installation, making computational education accessible to students and teachers across all devices and operating systems.</p>
      <p>This repository hosts the source code for the JupyterLite extension that powers Jupyter Everywhere.</p>
    </td>
  </tr>
</table>

<div align="center">

[![Build Status]][build-link]
[![License]][license-link]
[![Try Jupyter Everywhere]][jupytereverywhere-link]

[Build Status]: https://img.shields.io/github/actions/workflow/status/JupyterEverywhere/jupyterlite-extension/build.yml?branch=main&logo=github&label=build
[License]: https://img.shields.io/badge/license-BSD--3--Clause-blue.svg?logo=opensourceinitiative&logoColor=white

<!-- TODO: replace with main repo link before merge -->

[Try Jupyter Everywhere]: https://raw.githubusercontent.com/agriyakhetarpal/jupytereverywhere-jupyterlite-extension/refs/heads/cleanups-and-readme/static/badge.svg
[build-link]: https://github.com/JupyterEverywhere/jupyterlite-extension/actions/workflows/build.yml
[license-link]: https://github.com/JupyterEverywhere/jupyterlite-extension/blob/main/LICENSE
[jupytereverywhere-link]: https://jupytereverywhere.org

</div>

---

## Key features

- **In-browser computing**: runs entirely in web browsers using WebAssembly; no installation required on any device or operating system
- **Multi-language support**: built-in Python (via [Pyodide](https://pyodide.org/)) and R (via [xeus-r](https://github.com/jupyter-xeus/xeus-r)) kernel support
- **Multi-device access**: access, create copies of, and edit notebooks from any device right in your web browser (all major browsers are supported)

- **K12-focused design**: educational terminology and simplified interface for newcomers to programming and notebooks with a classroom-friendly, accessible design
- **Single-document interface**: simplified workspace focused on one notebook at a time, reducing distractions and complexity offered by traditional Jupyter
- **Instant sharing**: one-click notebook sharing with permanent links, eliminating the need for user accounts
- **View-only sharing**: share read-only notebooks, that can be copied for editing
- **Flexible export options**: download notebooks as `.ipynb` files or as PDF documents
- **Auto-save functionality**: automatic cloud synchronisation with manual save reminders

- **Data files**: need to work with files in your notebooks? Upload and download data files within the application via a simple grid view
- **Pre-installed packages**: popular data science and visualisation libraries such as `numpy`, `pandas`, `matplotlib`, and `seaborn`, and R packages like `ggplot2` and `dplyr` are ready to use

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

## Acknowledgments

Jupyter Everywhere is built on the powerful foundation of [the Jupyter ecosystem](https://jupyter.org/), particularly, [JupyterLite](https://jupyterlite.readthedocs.io/), [JupyterLab](https://jupyterlab.readthedocs.io/), the [Pyodide](https://pyodide.org/) and the [Xeus](https://github.com/jupyter-xeus/xeus) projects, and the broader scientific Python community. We're grateful to the maintainers and contributors of these projects who make educational computing accessible to everyone.

Work on Jupyter Everywhere has been made possible by the generous support of:

- [Skew The Script](https://skewthescript.org/), for supporting educational technology initiatives in the K-12 space
- [CourseKata](https://coursekata.org/), for advancing data science education through open source software
