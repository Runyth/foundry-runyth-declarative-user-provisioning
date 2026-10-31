# Release Process

1. Update version constants, `module.json`, `package.json`, changelog, and release documents.
2. Run `npm run check`.
3. Run `npm run package` twice and compare SHA-256 hashes.
4. Extract the source ZIP, run its checks and package command, and compare its install ZIP byte-for-byte.
5. Inspect all archive roots and runtime paths.
6. Complete the manual Foundry test plan before enabling automatic reconciliation in production.
