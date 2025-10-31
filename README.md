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

[![Build Status]][Link to builds]
[![License]][License file]
[![Try Jupyter Everywhere]][JupyterEverywhere]

[Build Status]: https://img.shields.io/github/actions/workflow/status/JupyterEverywhere/jupyterlite-extension/build.yml?branch=main&logo=github&label=build
[License]: https://img.shields.io/badge/license-BSD--3--Clause-blue.svg?logo=opensourceinitiative&logoColor=white
[Try Jupyter Everywhere]: https://raw.githubusercontent.com/JupyterEverywhere/jupyterlite-extension/refs/heads/main/static/badge.svg
[Link to builds]: https://github.com/JupyterEverywhere/jupyterlite-extension/actions/workflows/build.yml
[License file]: https://github.com/JupyterEverywhere/jupyterlite-extension/blob/main/LICENSE
[JupyterEverywhere]: https://jupytereverywhere.org

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

This extension requires `jupyterlab==4.5.0b1`, and additional dependencies listed in `lite/requirements.txt`.

## Getting started

### For end users

No installation is required! Simply visit [https://jupytereverywhere.org](https://jupytereverywhere.org) to start using Jupyter Everywhere directly in your web browser.

### For developers

To install the extension for development purposes, please follow the steps outlined in the "Development install" section below.

## Contributing

If you'd like to contribute to Jupyter Everywhere (thanks!), please read the following instructions to set up your development environment.

### Development install

Note: You will need Node.js to build the extension package.

The `jlpm` command is provided by JupyterLab's pinned version of [`yarn`](https://yarnpkg.com/) that is installed with JupyterLab.

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

To build the JupyterLite application after the extension has been installed into the environment, you can run the following commands from the root of this repository:

```bash
pip install -r lite/requirements.txt
jlpm build:all
```

which will install the necessary dependencies, install the extension into JupyterLite, and build the JupyterLite static assets. You can then serve the built JupyterLite application locally with a simple HTTP server, for example:

```bash
python -m http.server --directory dist 3000
```

### Linting

To ensure that the code follows the standard style and does not contain basic issues, run:

```bash
jlpm lint
```

You can have it run on relevant files automatically before each `git` commit, by installing [`pre-commit`](https://pre-commit.com/),
which will use the configuration provided in the `.pre-commit-config.yaml` file and install the necessary hooks:

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
folder is located. You can then remove the symlink named `jupytereverywhere` within that folder.

### Testing the extension

This extension uses [Playwright](https://playwright.dev/docs/intro) for the integration (snapshot) tests.

More information is provided within the [the `ui-tests/README.md` document](ui-tests/README.md).

### Releases

See [RELEASE.md](RELEASE.md) for instructions on creating a new release of the extension and the bundled JupyterLite application.

## Acknowledgments

Jupyter Everywhere is built on the powerful foundation of [the Jupyter ecosystem](https://jupyter.org/): particularly, [JupyterLite](https://jupyterlite.readthedocs.io/) and [JupyterLab](https://jupyterlab.readthedocs.io/). Additionally, it is powered by the [Pyodide](https://pyodide.org/) and the [Xeus](https://github.com/jupyter-xeus/xeus) projects, their intersections with the Jupyter ecosystem, and the broader scientific Python community. We are grateful to the maintainers, core developers, and contributors of these projects who make educational computing accessible to everyone.

Jupyter Everywhere (JE) is a collaborative project between [Skew The Script](https://skewthescript.org/) and [CourseKata](https://coursekata.org/), launched in 2024 with support from the Gates Foundation. Our initiative focuses on bringing data science tools and resources into classrooms by providing access to high-quality tools. Our goal is to empower teachers and students to explore data science and statistics easily, fostering deeper engagement and understanding in these essential fields.
