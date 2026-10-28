# dsh-agent-gate · 中文说明

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的工具调用装一道 **fail-closed** 权限闸门：风险分级、路径沙箱、调用限额、审计。

> 社区插件，与 DeepSeek 官方无关。  
> 逻辑移植自 [`canyueY/agent-gate`](https://github.com/canyueY/agent-gate)。

## 安装

```bash
dsh plugin --profile web add github:canyueY/dsh-agent-gate#plugin/dsh
```

## 工具

| 工具 | 作用 |
| --- | --- |
| `gate_check` | 预判某次工具调用是否会被放行 |
| `gate_check_path` | 路径是否落在 `allowed_roots` |
| `gate_policy` | 导出当前策略 |

插件还会在 `ctx.gate` 上挂 `PermissionGate`，供其它插件复用。

## 许可

AGPL-3.0-or-later
