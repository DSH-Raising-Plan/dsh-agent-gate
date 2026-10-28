/**
 * dsh-agent-gate — DeepSeek Harness plugin entry.
 * Port of https://github.com/canyueY/agent-gate
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  JsonlAuditLog,
  PermissionGate,
  describePolicy,
  permissionSettings,
} from './gate.js';
import { checkToolSpec, pathToolSpec, policyToolSpec } from './tool-spec.js';

export const name = 'dsh-agent-gate';
export const inject = ['tools'];

export { PermissionGate, permissionSettings, describePolicy } from './gate.js';

async function loadDefineTool() {
  try {
    const mod = await import('@deepseek-ai/dsh-tools');
    if (mod?.defineTool) return mod.defineTool;
  } catch { /* fall through */ }
  const override = process.env.DSH_TOOLS_PATH;
  if (override) {
    const mod = await import(pathToFileURL(override).href);
    if (mod?.defineTool) return mod.defineTool;
  }
  throw new Error('cannot resolve @deepseek-ai/dsh-tools (set DSH_TOOLS_PATH for local dev)');
}

function loadConfig(ctx) {
  const fromCtx = ctx?.config?.['dsh-agent-gate']
    ?? ctx?.config?.agentGate
    ?? ctx?.config?.permissions
    ?? null;
  if (fromCtx) return permissionSettings(fromCtx);

  const envPath = process.env.DSH_AGENT_GATE_CONFIG;
  if (envPath && fs.existsSync(envPath)) {
    try {
      return permissionSettings(JSON.parse(fs.readFileSync(envPath, 'utf8')));
    } catch { /* ignore */ }
  }
  return permissionSettings({
    enable: true,
    allowed_roots: process.env.DSH_AGENT_GATE_ROOTS
      ? process.env.DSH_AGENT_GATE_ROOTS.split(';').map((s) => s.trim()).filter(Boolean)
      : [],
    max_calls_per_minute: Number(process.env.DSH_AGENT_GATE_RPM || 30),
  });
}

export async function apply(ctx) {
  const defineTool = await loadDefineTool();
  const settings = loadConfig(ctx);
  const auditPath = process.env.DSH_AGENT_GATE_AUDIT
    || path.join(os.homedir(), '.dsh', 'agent-gate.audit.jsonl');
  const gate = new PermissionGate(settings, {
    auditSink: settings.audit ? new JsonlAuditLog(auditPath) : null,
  });
  ctx.gate = gate;

  const check = defineTool({
    ...checkToolSpec(),
    async execute(args) {
      const decision = gate.check(
        { name: args.tool, risk: args.risk },
        args.args && typeof args.args === 'object' ? args.args : {},
      );
      return {
        allowed: decision.allowed,
        decision: decision.decision,
        risk: decision.risk,
        reason: decision.reason,
        model_message: decision.modelMessage(),
      };
    },
  });

  const checkPath = defineTool({
    ...pathToolSpec(),
    async execute(args) {
      if (!args?.path) throw new Error('path is required');
      const decision = gate.checkPath(args.path);
      return {
        allowed: decision.allowed,
        decision: decision.decision,
        reason: decision.reason,
        model_message: decision.modelMessage(),
      };
    },
  });

  const policy = defineTool({
    ...policyToolSpec(),
    async execute() {
      return describePolicy(null, gate.settings);
    },
  });

  const disposers = [
    ctx.tools.register(check),
    ctx.tools.register(checkPath),
    ctx.tools.register(policy),
  ];
  return () => {
    for (const dispose of disposers.reverse()) dispose?.();
    delete ctx.gate;
  };
}
