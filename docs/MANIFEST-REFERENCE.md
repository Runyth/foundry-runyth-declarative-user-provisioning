# Manifest Reference

## Root

| Field | Required | Meaning |
|---|---:|---|
| `schemaVersion` | yes | Must be integer `1` |
| `defaults` | no | Default `enabled`, `role`, and `permissions` |
| `orphanPolicy` | no | `preserve` by default or `disable` |
| `users` | yes | Array of at most 1,000 desired users |

## User entry

| Field | Required | Meaning |
|---|---:|---|
| `key` | yes | Stable lowercase module identity, 1–64 characters |
| `name` | yes | Desired unique Foundry display name |
| `enabled` | no | `false` maps to role `NONE`; no deletion |
| `role` | no | `NONE`, `PLAYER`, `TRUSTED`, `ASSISTANT`, or `GAMEMASTER` |
| `color` | no | Six-digit hexadecimal color |
| `avatar` | no | Safe relative Foundry data path or `null` |
| `permissions` | no | Boolean map of runtime-supported Foundry permission identifiers |
| `match` | no | Exact existing User `id`, exact `name`, or both for explicit adoption |

## Adoption

`match` is intentionally strict. When both ID and name are provided, both must resolve to the same user. Missing, ambiguous, conflicting, or already-managed matches are errors. The module does not silently adopt by desired name.

## YAML subset

The bundled parser supports mappings, sequences, scalars, quoted strings, booleans, nulls, numbers, and simple inline collections. Indentation is two spaces. Tabs, anchors, aliases, tags, merge keys, and block scalars are rejected to keep parsing deterministic and auditable.

## Prohibited data

Authentication material and secret-like fields are invalid. Password establishment remains a separate Foundry administration workflow. Unknown fields are also invalid, preventing misspelled configuration from being ignored.
