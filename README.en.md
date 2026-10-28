# dsh-agent-gate

Fail-closed **permission gate** for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness): risk levels, path sandbox, rate limit, audit.

> Community plugin. Not affiliated with DeepSeek.  
> Logic ported from [`canyueY/agent-gate`](https://github.com/canyueY/agent-gate) (AGPL-3.0-or-later).  
> Chinese docs: [README.md](./README.md)

## Install

```bash
dsh plugin --profile web add github:DSH-Raising-Plan/dsh-agent-gate#plugin/dsh
```

## Tools

| Tool | Purpose |
| --- | --- |
| `gate_check` | Would this tool call be allowed? |
| `gate_check_path` | Is this path inside `allowed_roots`? |
| `gate_policy` | Dump current policy |

Also exposes `ctx.gate` (`PermissionGate`) for other plugins.

## License

AGPL-3.0-or-later
