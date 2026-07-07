// Campaign save-state — persisted on the character doc (a deviation from the
// subcollection sketch in docs/redesign/07-implementation.md §4, chosen so the
// whole campaign is one cheap merge-patch alongside the existing character
// writes). Additive & optional, so pre-campaign saves load untouched.

import type { WillState } from '../battle/will';
import { initWill, rollDay } from '../battle/will';
import type { MedalId } from './medals';

export interface CampaignState {
  version: number;
  will: WillState;
  chapter: number;                        // current chapter in progress (1-based)
  clearedChapters: number[];
  clearedNodes: Record<number, string[]>; // chapter → cleared node ids
  medals: MedalId[];
  defeatedEnemies: string[];              // enemy ids, for the dex
  dialogueSeen: string[];
  lordAttempts: string[];                 // lord enemy ids attempted (first-loss refund)
}

export const CAMPAIGN_VERSION = 1;

export function defaultCampaign(today: string): CampaignState {
  return {
    version: CAMPAIGN_VERSION,
    will: initWill(today),
    chapter: 1,
    clearedChapters: [],
    clearedNodes: {},
    medals: [],
    defeatedEnemies: [],
    dialogueSeen: [],
    lordAttempts: [],
  };
}

// Return the character's campaign (or a fresh default), with the Will day-roll
// applied so the per-day earn cap resets correctly on read.
export function ensureCampaign(
  campaign: CampaignState | undefined,
  today: string
): CampaignState {
  if (!campaign) return defaultCampaign(today);
  return {
    ...defaultCampaign(today), // backfills any missing fields on older saves
    ...campaign,
    will: rollDay(campaign.will ?? initWill(today), today),
  };
}

export function clearedNodeIds(campaign: CampaignState, chapter: number): string[] {
  return campaign.clearedNodes[chapter] ?? [];
}
