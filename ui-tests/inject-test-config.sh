set -eux
# Overwrite some settings to disable cursor blinking,
# which causes inadvertent playwright snapshot failures
cat jupyter-lite.json | jq '.["jupyter-config-data"].["settingsOverrides"] += {"@jupyterlab/codemirror-extension:plugin":{ "defaultConfig": { "cursorBlinkRate": 0 } } }' > jupyter-lite.json.tmp
mv jupyter-lite.json.tmp jupyter-lite.json
