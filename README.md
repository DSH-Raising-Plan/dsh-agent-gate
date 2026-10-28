# dsh-agent-gate

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的工具调用装一道 **fail-closed（默认拒绝）** 权限闸门：风险分级、路径沙箱、调用限额、审计。

> 社区插件，与 DeepSeek 官方无关。  
> 逻辑移植自 [`canyueY/agent-gate`](https://github.com/canyueY/agent-gate)（AGPL-3.0-or-later）。  
> 英文简版：[README.en.md](./README.en.md)

## 为什么需要它

Agent 能调工具之后，危险不在于“会不会调”，而在于**调用前有没有人问一句**。把判断散落在每个工具里，迟早会漏；这个插件把判断集中到一处：

- **三档风险**：`read_only` / `confirm` / `forbidden`，各自映射到 `allow` / `need_confirm` / `deny`；
- **路径沙箱**：路径类参数必须落在 `allowed_roots` 内，没配 roots 时 fail-closed；
- **调用限额**：每分钟最多 N 次，防止 Agent 循环刷工具；
- **审计**：每次判断写一行 JSONL，事后能查“为什么放行/拒绝”。

判断结果带 `model_message`，可以直接回给模型看，而不是只抛一个异常。

> **边界**：插件提供 `PermissionGate` 与三个查询工具，但**不会自动拦截宿主的所有工具调用**。需要 Agent/宿主在动作前调用 `gate_check`，或通过 `ctx.gate.check(tool, args)` 集成。没有接入的调用不受它保护。

## 特性

- fail-closed：`allowed_roots` 为空时，路径类调用一律拒绝；
- 风险别名：`low/medium/high` 会归一化到三档；
- 工具白/黑名单（`allow_tools` / `deny_tools`）；
- JSONL 审计默认写到 `~/.dsh/agent-gate.audit.jsonl`；
- 在 `ctx.gate` 上暴露 `PermissionGate`，其它插件可复用同一套策略。

## 安装

```bash
dsh plugin --profile web add github:DSH-Raising-Plan/dsh-agent-gate#plugin/dsh
```

也可克隆后，在 `cordis.patch.yml` 里指向本地路径。

## 工具

| 工具 | 参数 | 作用 |
| --- | --- | --- |
| `gate_check` | `tool`（必填）、`risk`、`args` | 预判某次工具调用是否会被放行（**不执行**） |
| `gate_check_path` | `path`（必填） | 路径是否落在 `allowed_roots` 沙箱内 |
| `gate_policy` | 无 | 导出当前策略（开关、roots、限额、白/黑名单） |

## 配置

环境变量：

| 变量 | 含义 |
| --- | --- |
| `DSH_AGENT_GATE_ROOTS` | 允许访问的根目录，`;` 分隔（为空则路径类调用一律拒绝） |
| `DSH_AGENT_GATE_RPM` | 每分钟最大调用次数（默认 30） |
| `DSH_AGENT_GATE_AUDIT` | JSONL 审计日志路径（默认 `~/.dsh/agent-gate.audit.jsonl`） |
| `DSH_AGENT_GATE_CONFIG` | JSON 配置文件路径，字段对齐 Python 包的 `agent.permissions` |

配置文件示例：

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

## 使用示例

```text
调用 run_shell 之前，先用 gate_check 检查 {"tool":"run_shell","risk":"confirm","args":{"cmd":"dir"}}
```

```text
gate_check_path {"path":"D:/work/notes.md"}   → allowed=true
gate_check_path {"path":"C:/Windows/system32"} → allowed=false（不在 allowed_roots）
```

## 限制

- 只检查**声明出来的**风险；调用方把 `forbidden` 说成 `read_only` 就绕过了，信任边界仍在 Agent/宿主；
- 路径检查只针对参数里“看起来像路径”的字段，不解析命令字符串；
- 限流是进程内滑窗，不跨进程共享；
- 审计是追加写，不会自动轮转，长期运行需要自己清理。

## 开发

```bash
npm test
npm run check
```

需要 `@deepseek-ai/dsh-tools`（或设置 `DSH_TOOLS_PATH`）才能在 Harness 中注册工具。

## 许可

AGPL-3.0-or-later
