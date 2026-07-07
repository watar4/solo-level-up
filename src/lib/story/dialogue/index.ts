import { CH01_DIALOGUE, type DialogueLine } from './ch01';

export type { DialogueLine };

// Flat dialogue registry keyed by id. Later chapters spread their maps in here.
export const DIALOGUE: Record<string, DialogueLine[]> = {
  ...CH01_DIALOGUE,
};

export function getDialogue(id: string): DialogueLine[] {
  return DIALOGUE[id] ?? [];
}
