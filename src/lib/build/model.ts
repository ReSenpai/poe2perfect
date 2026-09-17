/** Normalized build guide, independent of mobalytics' raw document shape. */

/** Raw Lexical editor state (`{ root }`); rendered by the rich text step. */
export interface RichText {
  root: unknown;
}

export interface Build {
  id: string;
  /** Full guide name, e.g. "[0.5.5] ED Contagion Lich League Starter (Level 1 to Endgame)". */
  name: string;
  /** Name without the leading patch marker. */
  title: string;
  patch: string | null;
  className: string | null;
  ascendancy: string | null;
  headerImageUrl: string | null;
  buildTypes: string[];
  author: string | null;
  updatedAt: string | null;
  sections: TextSection[];
  strengths: RichText | null;
  weaknesses: RichText | null;
  videoUrl: string | null;
  variants: Variant[];
  defaultVariantId: string | null;
  /** Campaign quest rewards the author took, by act. */
  questRewards: QuestAct[];
  /** Game entities mentioned as chips in guide texts, by slug; only those found in static data. */
  entities: Record<string, EntityInfo>;
  /** False when the site's static data was unavailable: no gem details, passive names, etc. */
  hasStaticData: boolean;
}

export interface QuestAct {
  /** e.g. "Act 2", "Interlude". */
  act: string;
  quests: QuestReward[];
}

export interface QuestReward {
  name: string;
  area: string | null;
  reward: string;
  /** The quest offers several rewards to pick from. */
  isChoice: boolean;
}

export interface TextSection {
  id: string;
  title: string;
  content: RichText;
}

export interface Variant {
  id: string;
  title: string;
  description: RichText | null;
  equipment: EquipmentSlot[];
  itemPriority: ItemRef[];
  equipmentNotes: RichText | null;
  skills: Skill[];
  gemRequirements: Attributes | null;
  /** Order in which the author suggests getting gems (mostly supports), each tied to its active skill. */
  gemPriority: GemPriorityEntry[];
  skillNotes: RichText | null;
  passives: Passives;
  passiveNotes: RichText | null;
  /** Null when the variant has no atlas tree (e.g. campaign variants). */
  atlas: AtlasTree | null;
  atlasNotes: RichText | null;
}

export type SlotId =
  | 'helmet'
  | 'body'
  | 'gloves'
  | 'boots'
  | 'mainHand'
  | 'offHand'
  | 'amulet'
  | 'leftRing'
  | 'rightRing'
  | 'extraRing'
  | 'belt'
  | 'flask1'
  | 'flask2'
  | 'charm1'
  | 'charm2'
  | 'charm3';

export interface EquipmentSlot {
  slot: SlotId;
  /** Weapon set for weapons (1 or 2), null for other slots. */
  weaponSet: 1 | 2 | null;
  item: Item;
  socketables: Socketable[];
}

export type Rarity = 'unique' | 'rare' | 'magic' | 'normal';

export interface Item {
  slug: string;
  name: string;
  iconUrl: string | null;
  rarity: Rarity;
  corrupted: boolean;
  itemClass: string | null;
  /** Display name of the item class, e.g. "Helmets". */
  itemClassName: string | null;
  modifiers: string[];
  /** Where modifiers come from: rolled values on the item, affix ranges, or the unique's static ranges. */
  modifiersSource: 'item' | 'affixes' | 'static' | 'none';
  /** Skills the item gives its wearer ("Grants Skill: Chaos Bolt"), e.g. on wands and staves. */
  grantedSkills: GrantedSkill[];
  /** Search for this item on the official trade site, as the build page offers it. */
  tradeUrl: string | null;
  properties: NameValue[];
  requirements: NameValue[];
  flavourText: string | null;
}

export interface GrantedSkill {
  name: string;
  /** As the game writes it, e.g. "(1-20)" or "12"; null when the base grants the skill without a level. */
  level: string | null;
  /** Null when the game data has no gem by that name. */
  gem: Gem | null;
}

export interface NameValue {
  name: string;
  value: string;
}

export interface Socketable {
  slug: string;
  name: string | null;
  iconUrl: string | null;
  effects: string[];
}

export interface ItemRef {
  slug: string;
  name: string;
  iconUrl: string | null;
  slot: string | null;
}

export interface Attributes {
  str: number;
  dex: number;
  int: number;
}

export interface Skill {
  gem: Gem;
  supports: Gem[];
}

export interface GemPriorityEntry {
  gem: Gem;
  parentSlug: string | null;
  parentName: string | null;
}

export interface Gem {
  slug: string;
  name: string;
  iconUrl: string | null;
  kind: 'active' | 'support';
  level: number | null;
  details: GemDetails | null;
}

export interface GemDetails {
  description: string | null;
  tags: string[];
  /** Level, cast time, mana: exact values at the build's gem level, otherwise the site's ranges. */
  stats: NameValue[];
  effects: string[];
  qualityEffects: string[];
  /** Requirement ranges as the site shows them, e.g. Level (1-97), Int (0-211). */
  requirements: NameValue[];
  /** Attribute split of the gem (drives its colour), e.g. { int: 100 }. */
  attributes: Partial<Attributes>;
}

export interface Passives {
  nodeCount: number;
  ascendancyNodeCount: number;
  /** Author's key passives, or selected notables and keystones when the author listed none. */
  keyPassives: Passive[];
  ascendancy: Passive[];
}

export interface AtlasTree {
  /** Nodes taken across all subtrees, including ones the current game data no longer knows. */
  pointCount: number;
  /** Subtrees with notables or keystones taken; empty groups are left out. */
  groups: AtlasGroup[];
}

export interface AtlasGroup {
  /** Key in the build data, e.g. "expeditionTree". */
  id: string;
  label: string;
  passives: Passive[];
}

export type PassiveKind = 'keystone' | 'notable' | 'ascendancy' | 'small' | 'jewel-socket';

export type EntityInfo =
  | { kind: 'item'; item: Item }
  | { kind: 'gem'; gem: Gem }
  | { kind: 'passive'; passive: Passive }
  | { kind: 'socketable'; socketable: Socketable };

export interface Passive {
  /** Tree node, null for a passive mentioned outside the tree (e.g. in guide text). */
  nodeSlug: string | null;
  slug: string | null;
  name: string;
  iconUrl: string | null;
  kind: PassiveKind;
  effects: string[];
  flavourText: string | null;
}
