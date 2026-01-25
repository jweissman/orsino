
export const DAMAGE_KINDS = [
  "bleed",
  "poison",
  "psychic",
  "lightning",
  "fire",
  "cold",
  "bludgeoning",
  "piercing",
  "slashing",
  "force",
  "radiant",
  "necrotic",
  "acid",
  "sonic",
  "true"
];

 // as const
export type DamageKind = typeof DAMAGE_KINDS[number];


  // = "bleed" |
  // "poison" |
  // "psychic" |
  // "lightning" |
  // "fire" |
  // "cold" |
  // "bludgeoning" |
  // "piercing" |
  // "slashing" |
  // "force" |
  // "radiant" |
  // "necrotic" |
  // "acid" |
  // "sonic" |
  // "true";

export const isMagicDamageKind = (kind: DamageKind): boolean => {
  const magicKinds: DamageKind[] = [
    "psychic",
    "lightning",
    "fire",
    "cold",
    "force",
    "radiant",
    "necrotic",
    "acid",
    "sonic",
    "true"
  ];
  return magicKinds.includes(kind);
}