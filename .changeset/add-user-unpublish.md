---
'@verdaccio/mcp-server': minor
---

feat: add `add_user` and `unpublish_package` tools

- `add_user` registers a user; `login` now uses Basic auth and reports when Verdaccio created the user. The token returned by either is reused by later calls.
- `unpublish_package` removes a version, or the whole package when it is the last one, moving `latest` to the highest remaining stable version.
- `publish_package` rejects already-published versions and sets the requested dist-tag correctly.
- `get_package` shows the version manifest when a version is given.
