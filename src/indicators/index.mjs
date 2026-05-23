// indicators/index.mjs - Aggregate all 33 indicators (v0.4)

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
  ...hooksIndicators,      // 4 (was 3; +IND-31)
  ...skillsIndicators,     // 4
  ...memoryIndicators,     // 6 (was 3; +IND-30/32/33)
  ...mcpIndicators,        // 4
  ...workflowIndicators,   // 6 (was 3; +IND-27/28/29)
];

// Runtime sanity check: v0.4 has exactly 33 indicators (was 26 in v0.3.x)
if (INDICATORS.length !== 33) {
  throw new Error(`neko-harness-doctor: expected 33 indicators, got ${INDICATORS.length}`);
}

export const CATEGORY_ORDER = [
  'claude-md', 'settings', 'hooks', 'skills', 'memory', 'mcp', 'workflow',
];
