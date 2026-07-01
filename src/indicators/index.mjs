// indicators/index.mjs - Aggregate all 39 indicators (v0.5.0: +IND-37/38/39)

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
  ...hooksIndicators,      // 8 (was 5; +IND-37/38/39)
  ...skillsIndicators,     // 4
  ...memoryIndicators,     // 7 (was 3; +IND-30/32/33/34)
  ...mcpIndicators,        // 4
  ...workflowIndicators,   // 7 (was 3; +IND-27/28/29/35)
];

// Runtime sanity check: v0.5.0+IND-37/38/39 has exactly 39 indicators
if (INDICATORS.length !== 39) {
  throw new Error(`neko-harness-doctor: expected 39 indicators, got ${INDICATORS.length}`);
}

export const CATEGORY_ORDER = [
  'claude-md', 'settings', 'hooks', 'skills', 'memory', 'mcp', 'workflow',
];
