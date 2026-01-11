export const SAVE_KINDS = [
  "poison",
  "disease",
  "death",
  "magic",
  "insanity",
  "charm",
  "fear",
  "stun",
  "will",
  "breath",
  "paralyze",
  "sleep",
  "bleed",
  "reflex",
  "fortitude"
] as const;

export type SaveKind = typeof SAVE_KINDS[number];
