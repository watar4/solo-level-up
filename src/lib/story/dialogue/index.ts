import { CH01_DIALOGUE, type DialogueLine } from './ch01';
import { REST_DIALOGUE } from './rest';

export type { DialogueLine };

// Flat dialogue registry keyed by id.
export const DIALOGUE: Record<string, DialogueLine[]> = {
  ...CH01_DIALOGUE,
  ...REST_DIALOGUE,
};

export function getDialogue(id: string): DialogueLine[] {
  return DIALOGUE[id] ?? [];
}
