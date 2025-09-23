set -eux
# Overwrite some settings to disable cursor blinking,
# which causes inadvertent playwright snapshot failures
cat jupyter-lite.json | jq '.["jupyter-config-data"].["settingsOverrides"] *= {"@jupyterlab/notebook-extension:tracker": { "codeCellConfig": { "cursorBlinkRate": 0 }, "markdownCellConfig": { "cursorBlinkRate": 0 }, "rawCellConfig": { "cursorBlinkRate": 0 } }, "@jupyterlab/codemirror-extension:plugin":{ "defaultConfig": { "cursorBlinkRate": 0, "lineNumbers": false } } }' > jupyter-lite.json.tmp
mv jupyter-lite.json.tmp jupyter-lite.json
