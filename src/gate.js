/**
 * Permission gate — TypeScript-free port of canyueY/agent-gate.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const RISK_READ_ONLY = 'read_only';
export const RISK_CONFIRM = 'confirm';
export const RISK_FORBIDDEN = 'forbidden';
export const VALID_RISKS = [RISK_READ_ONLY, RISK_CONFIRM, RISK_FORBIDDEN];

export const DECISION_ALLOW = 'allow';
export const DECISION_NEED_CONFIRM = 'need_confirm';
export const DECISION_DENY = 'deny';
export const VALID_DECISIONS = [DECISION_ALLOW, DECISION_NEED_CONFIRM, DECISION_DENY];

export const RISK_ALIASES = {
  low: RISK_READ_ONLY,
  safe: RISK_READ_ONLY,
  read: RISK_READ_ONLY,
  readonly: RISK_READ_ONLY,
  read_only: RISK_READ_ONLY,
  medium: RISK_CONFIRM,
  mid: RISK_CONFIRM,
  write: RISK_CONFIRM,
  confirm: RISK_CONFIRM,
  high: RISK_FORBIDDEN,
  danger: RISK_FORBIDDEN,
  dangerous: RISK_FORBIDDEN,
  forbidden: RISK_FORBIDDEN,
  deny: RISK_FORBIDDEN,
};

const PATH_ARG_KEYS = ['path', 'file', 'filepath', 'root', 'directory', 'dir', 'target_path'];
const SENSITIVE_KEYS = ['key', 'token', 'secret', 'password', 'passwd', 'cookie', 'auth'];

export function normalizeRisk(value) {
  const s = String(value ?? '').trim().toLowerCase();
  if (!s) return RISK_CONFIRM;
  if (VALID_RISKS.includes(s)) return s;
  return RISK_ALIASES[s] ?? RISK_CONFIRM;
}

export function normalizeDecision(value, fallback) {
  const s = String(value ?? '').trim().toLowerCase();
  if (VALID_DECISIONS.includes(s)) return s;
  if (typeof value === 'boolean') return value ? DECISION_ALLOW : DECISION_DENY;
  return fallback;
}

function asBool(value, fallback) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return ['1', 'true', 'yes', 'y', 'on'].includes(value.trim().toLowerCase());
  }
  return value == null ? fallback : Boolean(value);
}

function asStrList(value) {
  let raw = [];
  if (Array.isArray(value)) raw = value.map((x) => String(x).trim()).filter(Boolean);
  else if (typeof value === 'string') {
    raw = value.split(',').map((x) => x.trim()).filter(Boolean);
  }
  return raw.filter((x) => x !== '.' && x !== '..');
}

export function permissionSettings(cfg = null) {
  let block = {};
  try {
    const agent = cfg?.agent;
    if (agent && typeof agent === 'object' && agent.permissions && typeof agent.permissions === 'object') {
      block = { ...agent.permissions };
    } else if (cfg?.permissions && typeof cfg.permissions === 'object') {
      block = { ...cfg.permissions };
    } else if (cfg && typeof cfg === 'object' && ('enable' in cfg || 'allowed_roots' in cfg)) {
      block = { ...cfg };
    }
  } catch {
    block = {};
  }

  return {
    enable: asBool(block.enable, true),
    read_only: normalizeDecision(block.read_only, DECISION_ALLOW),
    confirm: normalizeDecision(block.confirm, DECISION_NEED_CONFIRM),
    forbidden: normalizeDecision(block.forbidden, DECISION_DENY),
    allow_tools: asStrList(block.allow_tools),
    deny_tools: asStrList(block.deny_tools),
    allowed_roots: asStrList(block.allowed_roots),
    max_calls_per_minute: Math.max(0, Number.parseInt(block.max_calls_per_minute ?? 30, 10) || 30),
    audit: asBool(block.audit, true),
  };
}

export function normalizeRoot(root) {
  let p = String(root);
  if (p.startsWith('~')) p = path.join(os.homedir(), p.slice(1).replace(/^[/\\]/, ''));
  if (!path.isAbsolute(p)) p = path.resolve(process.cwd(), p);
  try {
    return fs.realpathSync.native ? fs.realpathSync.native(p) : fs.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
}

export function pathAllowed(rawPath, roots) {
  const list = Array.isArray(roots) ? roots : [];
  if (!list.length) {
    return { allowed: false, reason: '未配置允许目录（allowed_roots 为空，按 fail closed 拒绝）' };
  }
  if (rawPath == null || String(rawPath).trim() === '') {
    return { allowed: false, reason: '路径为空' };
  }
  let target;
  let expanded = String(rawPath);
  if (expanded.startsWith('~')) {
    expanded = path.join(os.homedir(), expanded.slice(1).replace(/^[/\\]/, ''));
  }
  try {
    target = fs.realpathSync.native ? fs.realpathSync.native(expanded) : fs.realpathSync(expanded);
  } catch {
    target = path.resolve(expanded);
  }
  for (const root of list) {
    const base = normalizeRoot(root);
    if (target === base) return { allowed: true, reason: '' };
    const rel = path.relative(base, target);
    if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) {
      return { allowed: true, reason: '' };
    }
  }
  return { allowed: false, reason: `路径不在允许目录内：${target}` };
}

export class PermissionDecision {
  constructor({ decision, risk, reason, tool = '' }) {
    this.decision = decision;
    this.risk = risk;
    this.reason = reason;
    this.tool = tool;
  }

  get allowed() {
    return this.decision === DECISION_ALLOW;
  }

  get needsConfirmation() {
    return this.decision === DECISION_NEED_CONFIRM;
  }

  modelMessage() {
    if (this.allowed) return '已允许执行。';
    if (this.decision === DECISION_NEED_CONFIRM) {
      return (
        `工具 ${this.tool} 会改动本机状态，需要用户确认后才能执行；` +
        `本轮**未执行**。请先向用户说明你要做什么并征求同意，不要重试。` +
        `（原因：${this.reason}）`
      );
    }
    return (
      `工具 ${this.tool} 被权限策略拒绝，本轮**未执行**，` +
      `请改用其他办法或直接告诉用户。（原因：${this.reason}）`
    );
  }

  asDict() {
    return {
      tool: this.tool,
      risk: this.risk,
      decision: this.decision,
      reason: this.reason,
    };
  }
}

function safeArgs(args, limit = 2000) {
  if (!args || typeof args !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(args).slice(0, 40)) {
    if (SENSITIVE_KEYS.some((s) => String(k).toLowerCase().includes(s))) out[k] = '***';
    else if (v == null || ['string', 'number', 'boolean'].includes(typeof v)) out[k] = v;
    else out[k] = `<${typeof v}>`;
  }
  try {
    if (JSON.stringify(out).length > limit) {
      return { _truncated: true, _keys: Object.keys(out).sort().slice(0, 40) };
    }
  } catch {
    return { _unserialisable: true };
  }
  return out;
}

export class JsonlAuditLog {
  constructor(filePath, { maxBytes = 8 << 20 } = {}) {
    this.path = String(filePath);
    this.maxBytes = maxBytes;
    const parent = path.dirname(path.resolve(this.path));
    if (parent) fs.mkdirSync(parent, { recursive: true });
  }

  _rotateIfNeeded() {
    try {
      if (fs.statSync(this.path).size < this.maxBytes) return;
    } catch {
      return;
    }
    try {
      fs.renameSync(this.path, `${this.path}.1`);
    } catch {
      /* keep writing */
    }
  }

  write(record) {
    const line = `${JSON.stringify(record)}\n`;
    this._rotateIfNeeded();
    fs.appendFileSync(this.path, line, 'utf8');
  }
}

export class PermissionGate {
  constructor(settings = null, { approver = null, auditSink = null, clock = null } = {}) {
    this.settings = settings || permissionSettings();
    this.approver = approver;
    this.auditSink = auditSink;
    this._clock = clock || (() => performance.now() / 1000);
    this._stamps = [];
  }

  decisionForRisk(risk) {
    const r = normalizeRisk(risk);
    if (r === RISK_READ_ONLY) return this.settings.read_only;
    if (r === RISK_CONFIRM) return this.settings.confirm;
    return this.settings.forbidden;
  }

  _prune(now) {
    const cutoff = now - 60;
    this._stamps = this._stamps.filter((t) => t > cutoff);
  }

  recentCalls(now = null) {
    const t = now ?? this._clock();
    this._prune(t);
    return this._stamps.length;
  }

  _underQuota(now) {
    const limit = this.settings.max_calls_per_minute;
    if (limit <= 0) return true;
    return this.recentCalls(now) < limit;
  }

  noteCall(now = null) {
    const t = now ?? this._clock();
    this._prune(t);
    this._stamps.push(t);
  }

  _audit(decision, { source, args }) {
    if (!(this.settings.audit && this.auditSink)) return;
    try {
      this.auditSink.write({
        ts: Date.now() / 1000,
        source,
        args: safeArgs(args),
        ...decision.asDict(),
      });
    } catch {
      /* audit must not break calls */
    }
  }

  check(tool, args = null, { source = 'chat', now = null } = {}) {
    const name = String(tool?.name ?? tool ?? '').trim();
    const risk = normalizeRisk(tool?.risk);
    const callArgs = { ...(args || {}) };

    for (const key of PATH_ARG_KEYS) {
      const val = callArgs[key];
      if (typeof val === 'string' && val.trim()) {
        const { allowed, reason } = pathAllowed(val, this.settings.allowed_roots);
        if (!allowed) {
          const result = new PermissionDecision({
            decision: DECISION_DENY,
            risk: RISK_READ_ONLY,
            reason,
            tool: name,
          });
          this._audit(result, { source, args: callArgs });
          return result;
        }
      }
    }

    if (!this.settings.enable) {
      const result = new PermissionDecision({
        decision: DECISION_ALLOW,
        risk,
        reason: '权限闸门已关闭',
        tool: name,
      });
      this._audit(result, { source, args: callArgs });
      return result;
    }

    if (this.settings.deny_tools.includes(name)) {
      const result = new PermissionDecision({
        decision: DECISION_DENY,
        risk,
        reason: '工具在 deny_tools 名单里',
        tool: name,
      });
      this._audit(result, { source, args: callArgs });
      return result;
    }

    const t = now ?? this._clock();
    if (!this._underQuota(t)) {
      const result = new PermissionDecision({
        decision: DECISION_DENY,
        risk,
        reason: `每分钟调用上限已用尽（${this.settings.max_calls_per_minute} 次/分钟）`,
        tool: name,
      });
      this._audit(result, { source, args: callArgs });
      return result;
    }

    let base;
    let reason;
    if (this.settings.allow_tools.includes(name)) {
      base = DECISION_ALLOW;
      reason = '工具在 allow_tools 名单里（显式放行）';
    } else {
      base = this.decisionForRisk(risk);
      reason = `risk=${risk} 的策略为 ${base}`;
    }

    let result;
    if (base === DECISION_ALLOW) {
      result = new PermissionDecision({ decision: DECISION_ALLOW, risk, reason, tool: name });
    } else if (base === DECISION_NEED_CONFIRM) {
      result = this._askApprover(name, risk, callArgs);
    } else {
      result = new PermissionDecision({ decision: DECISION_DENY, risk, reason, tool: name });
    }
    this._audit(result, { source, args: callArgs });
    return result;
  }

  _askApprover(name, risk, args) {
    if (!this.approver) {
      return new PermissionDecision({
        decision: DECISION_NEED_CONFIRM,
        risk,
        reason: '尚无确认通道，confirm 一律不执行',
        tool: name,
      });
    }
    try {
      const verdict = this.approver(name, { ...(args || {}) });
      if (typeof verdict === 'string') {
        const text = verdict.trim();
        if (text) {
          return new PermissionDecision({
            decision: DECISION_ALLOW, risk, reason: text, tool: name,
          });
        }
        return new PermissionDecision({
          decision: DECISION_NEED_CONFIRM, risk, reason: '用户未同意', tool: name,
        });
      }
      if (verdict) {
        return new PermissionDecision({
          decision: DECISION_ALLOW, risk, reason: '用户已确认', tool: name,
        });
      }
      return new PermissionDecision({
        decision: DECISION_NEED_CONFIRM, risk, reason: '用户未同意', tool: name,
      });
    } catch (err) {
      return new PermissionDecision({
        decision: DECISION_NEED_CONFIRM,
        risk,
        reason: `确认通道异常：${err}`,
        tool: name,
      });
    }
  }

  checkPath(rawPath) {
    const { allowed, reason } = pathAllowed(rawPath, this.settings.allowed_roots);
    const result = new PermissionDecision({
      decision: allowed ? DECISION_ALLOW : DECISION_DENY,
      risk: RISK_READ_ONLY,
      reason: reason || '路径在允许目录内',
      tool: 'path',
    });
    this._audit(result, { source: 'path', args: { path: String(rawPath) } });
    return result;
  }
}

export function describePolicy(registry = null, settings = null) {
  const st = settings || permissionSettings();
  const tools = [];
  const list = registry?.all?.() ?? registry ?? [];
  for (const tool of list) {
    const risk = normalizeRisk(tool?.risk);
    let decision;
    if (!st.enable) decision = DECISION_ALLOW;
    else if (st.deny_tools.includes(tool?.name)) decision = DECISION_DENY;
    else if (st.allow_tools.includes(tool?.name)) decision = DECISION_ALLOW;
    else {
      decision = {
        [RISK_READ_ONLY]: st.read_only,
        [RISK_CONFIRM]: st.confirm,
        [RISK_FORBIDDEN]: st.forbidden,
      }[risk];
    }
    tools.push({
      name: tool?.name ?? '',
      group: tool?.group ?? '',
      risk,
      decision,
    });
  }
  return {
    enable: st.enable,
    read_only: st.read_only,
    confirm: st.confirm,
    forbidden: st.forbidden,
    allow_tools: [...st.allow_tools],
    deny_tools: [...st.deny_tools],
    allowed_roots: [...st.allowed_roots],
    max_calls_per_minute: st.max_calls_per_minute,
    audit: st.audit,
    tools,
  };
}
