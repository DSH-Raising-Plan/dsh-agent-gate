import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {
  PermissionGate,
  normalizeRisk,
  pathAllowed,
  permissionSettings,
  DECISION_ALLOW,
  DECISION_DENY,
  DECISION_NEED_CONFIRM,
  RISK_CONFIRM,
} from '../src/gate.js';

describe('normalizeRisk', () => {
  it('maps aliases and unknowns to confirm', () => {
    assert.equal(normalizeRisk('low'), 'read_only');
    assert.equal(normalizeRisk('high'), 'forbidden');
    assert.equal(normalizeRisk('banana'), RISK_CONFIRM);
    assert.equal(normalizeRisk(''), RISK_CONFIRM);
  });
});

describe('pathAllowed fail-closed', () => {
  it('rejects when roots empty', () => {
    const r = pathAllowed(os.homedir(), []);
    assert.equal(r.allowed, false);
  });

  it('allows paths under roots', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-'));
    const file = path.join(root, 'a.txt');
    fs.writeFileSync(file, 'x');
    const r = pathAllowed(file, [root]);
    assert.equal(r.allowed, true);
    fs.rmSync(root, { recursive: true, force: true });
  });
});

describe('PermissionGate', () => {
  it('deny_tools wins', () => {
    const gate = new PermissionGate(permissionSettings({
      enable: true,
      deny_tools: ['shell'],
      allowed_roots: [os.tmpdir()],
    }));
    const d = gate.check({ name: 'shell', risk: 'low' });
    assert.equal(d.decision, DECISION_DENY);
  });

  it('confirm without approver does not execute', () => {
    const gate = new PermissionGate(permissionSettings({
      enable: true,
      allowed_roots: [os.tmpdir()],
    }));
    const d = gate.check({ name: 'write_file', risk: 'confirm' }, { path: path.join(os.tmpdir(), 'x') });
    // path may not exist -> deny from sandbox; use tool without path
    const d2 = gate.check({ name: 'send_msg', risk: 'confirm' }, {});
    assert.equal(d2.decision, DECISION_NEED_CONFIRM);
    assert.match(d2.modelMessage(), /未执行/);
  });

  it('allow_tools elevates', () => {
    const gate = new PermissionGate(permissionSettings({
      enable: true,
      allow_tools: ['write_file'],
      allowed_roots: [os.tmpdir()],
    }));
    const d = gate.check({ name: 'write_file', risk: 'forbidden' }, {});
    assert.equal(d.decision, DECISION_ALLOW);
  });
});
