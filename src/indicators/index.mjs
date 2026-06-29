// indicators/index.mjs - Aggregate all 36 indicators (v0.4.1+IND-36)

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
  ...hooksIndicators,      // 5 (was 4; +IND-36)
  ...skillsIndicators,     // 4
  ...memoryIndicators,     // 7 (was 3; +IND-30/32/33/34)
  ...mcpIndicators,        // 4
  ...workflowIndicators,   // 7 (was 3; +IND-27/28/29/35)
];

// Runtime sanity check: v0.4.1+IND-36 has exactly 36 indicators
if (INDICATORS.length !== 36) {
  throw new Error(`neko-harness-doctor: expected 36 indicators, got ${INDICATORS.length}`);
}

export const CATEGORY_ORDER = [
  'claude-md', 'settings', 'hooks', 'skills', 'memory', 'mcp', 'workflow',
];
