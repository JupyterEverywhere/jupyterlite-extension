# Creating a new release of Jupyter Everywhere

We release the extension bundled with the full JupyterLite application files as a tarball on GitHub Releases. To do so,

1. Bump the version in the `package.json` file to the new version.
2. Create a new tag with the same version, and push it to GitHub:

```bash
git tag -s vX.Y.Z -m "Release vX.Y.Z"
git push vX.Y.Z
```

3. Create a new release on GitHub, using the tag created in the previous step. This will trigger the `.github/workflows/cd.yml`
   workflow, which will build the extension, install it, install JupyterLite, build the JupyterLite static assets, and create
   a tarball with the resulting files. The tarball will be attached to the GitHub Release.

4. You may verify that the attached tarball contains the expected files, and proceed to deploy it with the sharing service
   in [the `jupytereverywhere/infrastructure` repository](https://github.com/JupyterEverywhere/infrastructure).
