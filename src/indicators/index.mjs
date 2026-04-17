// indicators/index.mjs - Aggregate all 26 indicators

import { claudeMdIndicators } from './claude-md.mjs';
import { settingsIndicators } from './settings.mjs';
import { hooksIndicators } from './hooks.mjs';
import { skillsIndicators } from './skills.mjs';
import { memoryIndicators } from './memory.mjs';
import { mcpIndicators } from './mcp.mjs';
import { workflowIndicators } from './workflow.mjs';

export const INDICATORS = [
  ...claudeMdIndicators,   // 5
  ...settingsIndicators,   // 4
  ...hooksIndicators,      // 3
  ...skillsIndicators,     // 4
  ...memoryIndicators,     // 3
  ...mcpIndicators,        // 4
  ...workflowIndicators,   // 3
];

// Runtime sanity check: always exactly 26 indicators
if (INDICATORS.length !== 26) {
  throw new Error(`neko-harness-doctor: expected 26 indicators, got ${INDICATORS.length}`);
}

export const CATEGORY_ORDER = [
  'claude-md', 'settings', 'hooks', 'skills', 'memory', 'mcp', 'workflow',
];
