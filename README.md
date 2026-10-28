# dsh-agent-gate

Fail-closed **permission gate** for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness): risk levels, path sandbox, rate limit, audit.

> Community plugin. Not affiliated with DeepSeek.  
> Logic ported from [`canyueY/agent-gate`](https://github.com/canyueY/agent-gate) (AGPL-3.0-or-later).

## Install

```bash
dsh plugin --profile web add github:canyueY/dsh-agent-gate#plugin/dsh
```

Or clone and point `cordis.patch.yml` at the local path.

## Tools

| Tool | Purpose |
| --- | --- |
| `gate_check` | Would this tool call be allowed? |
| `gate_check_path` | Is this path inside `allowed_roots`? |
| `gate_policy` | Dump current policy |

Also exposes `ctx.gate` (`PermissionGate`) for other plugins.

## Config

Environment:

- `DSH_AGENT_GATE_ROOTS` — `;`-separated allowed roots (empty = deny all paths)
- `DSH_AGENT_GATE_RPM` — max calls / minute (default 30)
- `DSH_AGENT_GATE_AUDIT` — JSONL audit path (default `~/.dsh/agent-gate.audit.jsonl`)
- `DSH_AGENT_GATE_CONFIG` — JSON file with the same shape as `agent.permissions` in the Python package

## License

AGPL-3.0-or-later
