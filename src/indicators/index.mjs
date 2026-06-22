// indicators/index.mjs - Aggregate all 35 indicators (v0.4.1)

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
  ...memoryIndicators,     // 7 (was 3; +IND-30/32/33/34)
  ...mcpIndicators,        // 4
  ...workflowIndicators,   // 7 (was 3; +IND-27/28/29/35)
];

// Runtime sanity check: v0.4.1 has exactly 35 indicators (was 33 in v0.4)
if (INDICATORS.length !== 35) {
  throw new Error(`neko-harness-doctor: expected 35 indicators, got ${INDICATORS.length}`);
}

export const CATEGORY_ORDER = [
  'claude-md', 'settings', 'hooks', 'skills', 'memory', 'mcp', 'workflow',
];
