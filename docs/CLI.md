# CLI Workflows

The CLI is dependency-free and requires Node.js 22–26.

```text
node tools/user-manifest.mjs init users.yaml
node tools/user-manifest.mjs init users.json
node tools/user-manifest.mjs validate users.yaml
node tools/user-manifest.mjs format users.yaml
node tools/user-manifest.mjs format users.yaml --output users.json --format json
node tools/user-manifest.mjs digest users.yaml
node tools/user-manifest.mjs schema --output manifest.schema.json
node tools/user-manifest.mjs plan users.yaml --snapshot foundry-users-world.json
node tools/user-manifest.mjs plan users.yaml --snapshot foundry-users-world.json --orphan-policy disable
```

`init` refuses to overwrite unless `--force` is supplied. `validate` exits 1 for schema errors. `plan` exits 1 for reconciliation or safety errors. Usage and I/O failures exit 2.

A snapshot is exported from the dashboard or through `api.exportSnapshot({ download: true })`. It contains user IDs, names, roles, managed keys, optional managed fields, active state, and current-user marker; it does not contain authentication data.
