# dsh-agent-gate

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的工具调用装一道 **fail-closed（默认拒绝）** 权限闸门：风险分级、路径沙箱、调用限额、审计。

> 社区插件，与 DeepSeek 官方无关。  
> 逻辑移植自 [`canyueY/agent-gate`](https://github.com/canyueY/agent-gate)（AGPL-3.0-or-later）。  
> 英文简版：[README.en.md](./README.en.md)

## 安装

```bash
dsh plugin --profile web add github:DSH-Raising-Plan/dsh-agent-gate#plugin/dsh
```

也可克隆后，在 `cordis.patch.yml` 里指向本地路径。

## 工具

| 工具 | 作用 |
| --- | --- |
| `gate_check` | 预判某次工具调用是否会被放行（不真正执行） |
| `gate_check_path` | 路径是否落在 `allowed_roots` 沙箱内 |
| `gate_policy` | 导出当前策略（开关、根目录、限额、黑白名单） |

插件还会在 `ctx.gate` 上挂 `PermissionGate`，供其它插件复用。

## 配置

环境变量：

| 变量 | 含义 |
| --- | --- |
| `DSH_AGENT_GATE_ROOTS` | 允许访问的根目录，`;` 分隔（为空则路径类调用一律拒绝） |
| `DSH_AGENT_GATE_RPM` | 每分钟最大调用次数（默认 30） |
| `DSH_AGENT_GATE_AUDIT` | JSONL 审计日志路径（默认 `~/.dsh/agent-gate.audit.jsonl`） |
| `DSH_AGENT_GATE_CONFIG` | JSON 配置文件路径（字段对齐 Python 包的 `agent.permissions`） |

## 开发

```bash
npm test
npm run check
```

需要 `@deepseek-ai/dsh-tools`（或设置 `DSH_TOOLS_PATH`）才能在 Harness 中注册工具。

## 许可

AGPL-3.0-or-later
