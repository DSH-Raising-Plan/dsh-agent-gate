/** Tool specs without execute — host schema subset only. */

export const CHECK_TOOL = 'gate_check';
export const PATH_TOOL = 'gate_check_path';
export const POLICY_TOOL = 'gate_policy';

export function checkToolSpec() {
  return {
    name: CHECK_TOOL,
    description: [
      'Check whether a named tool call would be allowed by the fail-closed permission gate.',
      'Does NOT execute the tool. Returns decision + a model_message you should show or follow.',
      'Use before risky actions, or to explain why a previous call was blocked.',
    ].join('\n'),
    parameters: {
      tool: {
        type: 'string',
        required: true,
        description: 'Tool name to evaluate.',
      },
      risk: {
        type: 'string',
        description: 'Declared risk: read_only | confirm | forbidden (aliases: low/medium/high). Default: confirm.',
      },
      args: {
        type: 'json',
        description: 'Args that would be passed (path-like keys are sandboxed against allowed_roots).',
      },
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          allowed: { type: 'boolean' },
          decision: { type: 'string' },
          risk: { type: 'string' },
          reason: { type: 'string' },
          model_message: { type: 'string' },
        },
      },
      render: (_args, value) => [{ type: 'text', text: value.model_message || JSON.stringify(value) }],
    },
  };
}

export function pathToolSpec() {
  return {
    name: PATH_TOOL,
    description: 'Check whether a filesystem path sits inside the gate allowed_roots sandbox (fail-closed when roots are empty).',
    parameters: {
      path: {
        type: 'string',
        required: true,
        description: 'Absolute or ~ path to check.',
      },
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          allowed: { type: 'boolean' },
          decision: { type: 'string' },
          reason: { type: 'string' },
          model_message: { type: 'string' },
        },
      },
      render: (_args, value) => [{ type: 'text', text: value.model_message || JSON.stringify(value) }],
    },
  };
}

export function policyToolSpec() {
  return {
    name: POLICY_TOOL,
    description: 'Return the current permission policy (enable flags, roots, rate limit, allow/deny lists).',
    parameters: {},
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
  };
}
