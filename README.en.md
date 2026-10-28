# dsh-agent-gate

A **fail-closed permission gate** for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) tool calls: risk tiers, path sandbox, rate limit, and audit.

> Community plugin. Not affiliated with DeepSeek.  
> Logic ported from [`canyueY/agent-gate`](https://github.com/canyueY/agent-gate) (AGPL-3.0-or-later).  
> Chinese docs: [README.md](./README.md)

## Why

Once an agent can call tools, the danger is not *whether* it calls them — it is **whether anyone asks a question first**. Spreading that decision across every tool eventually leaks. This plugin centralizes it:

- **Three risk tiers** — `read_only` / `confirm` / `forbidden`, mapped to `allow` / `need_confirm` / `deny`;
- **Path sandbox** — path-like arguments must sit under `allowed_roots`; no roots means fail-closed;
- **Rate limit** — at most N calls per minute, so the agent cannot loop on tools;
- **Audit** — one JSONL line per decision, so you can explain why something was allowed or denied.

Each decision carries a `model_message` the model can read directly, instead of an opaque exception.

> **Boundary:** the plugin exposes a `PermissionGate` plus three query tools — it does **not** automatically intercept every host tool call. The agent/host has to call `gate_check` before acting, or integrate via `ctx.gate.check(tool, args)`. Calls that never consult the gate are not protected.

## Features

- Fail-closed: empty `allowed_roots` denies every path-like call;
- Risk aliases (`low/medium/high`) normalized to the three tiers;
- Tool allow/deny lists (`allow_tools` / `deny_tools`);
- JSONL audit, default `~/.dsh/agent-gate.audit.jsonl`;
- Exposes `ctx.gate` (`PermissionGate`) so other plugins can reuse the same policy.

## Install

```bash
dsh plugin --profile web add github:DSH-Raising-Plan/dsh-agent-gate#plugin/dsh
```

Or clone it and point `cordis.patch.yml` at the local path.

## Tools

| Tool | Arguments | Purpose |
| --- | --- | --- |
| `gate_check` | `tool` (required), `risk`, `args` | Would this tool call be allowed? **Does not execute it.** |
| `gate_check_path` | `path` (required) | Is this path inside the `allowed_roots` sandbox? |
| `gate_policy` | none | Dump the current policy (enable flags, roots, limit, allow/deny lists) |

## Configuration

Environment variables:

| Variable | Meaning |
| --- | --- |
| `DSH_AGENT_GATE_ROOTS` | Allowed roots, `;`-separated (empty denies all path-like calls) |
| `DSH_AGENT_GATE_RPM` | Max calls per minute (default 30) |
| `DSH_AGENT_GATE_AUDIT` | JSONL audit path (default `~/.dsh/agent-gate.audit.jsonl`) |
| `DSH_AGENT_GATE_CONFIG` | JSON config path matching the Python package's `agent.permissions` |

Config file example:

```json
{
  "agent": {
    "permissions": {
      "enable": true,
      "allowed_roots": ["D:/work", "C:/Users/me/Documents"],
      "max_calls_per_minute": 30,
      "audit": true,
      "read_only": "allow",
      "confirm": "need_confirm",
      "forbidden": "deny",
      "allow_tools": [],
      "deny_tools": ["run_shell"]
    }
  }
}
```

## Examples

```text
Before run_shell, call gate_check {"tool":"run_shell","risk":"confirm","args":{"cmd":"dir"}}
```

```text
gate_check_path {"path":"D:/work/notes.md"}    → allowed=true
gate_check_path {"path":"C:/Windows/system32"} → allowed=false (outside allowed_roots)
```

## Limitations

- Only the **declared** risk is checked; an agent that calls `forbidden` `read_only` bypasses the tier;
- Path checks only cover arguments that *look like* paths; command strings are not parsed;
- Rate limiting is an in-process sliding window, not shared across processes;
- Audit is append-only and never rotated; long-running setups must prune it themselves.

## Development

```bash
npm test
npm run check
```

Requires `@deepseek-ai/dsh-tools` (or `DSH_TOOLS_PATH`) to register tools inside Harness.

## License

AGPL-3.0-or-later
