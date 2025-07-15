set -eux
# Inject service URL
cat jupyter-lite.json | jq '.["jupyter-config-data"]["sharing_service_api_url"] = "https://jupytereverywhere.coursekata.org/api/v1"' > jupyter-lite.json.tmp
mv jupyter-lite.json.tmp jupyter-lite.json
