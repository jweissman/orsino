import { Combatant } from "./Combatant";
import { ItemInstance } from "./ItemInstance";

export interface CombatContext {
  subject: Combatant;

  allies: Combatant[];
  enemies: Combatant[];
  allySide: Combatant[];
  enemySide: Combatant[];

  inventory: ItemInstance[];
  enemyInventory: ItemInstance[];

  allyIds: Set<string>;
  enemyIds: Set<string>;
}

export const pseudocontextFor = (subject: Combatant, inventory: ItemInstance[]): CombatContext => {
  return {
    subject,
    allies: [],
    enemies: [],
    inventory,
    enemyInventory: [],
    allySide: [subject],
    enemySide: [],
    allyIds: new Set<string>([subject.id]),
    enemyIds: new Set<string>(),
  };
}

export const translateContext = (context: CombatContext, newSubject: Combatant): CombatContext => {
  const actorSide = context.allySide;
  const actorIds = new Set(actorSide.map(c => c.id));

  const reactor = newSubject;
  const reactorOnActorSide = actorIds.has(reactor.id);
  const allySide = reactorOnActorSide ? context.allySide : context.enemySide;
  const enemySide = reactorOnActorSide ? context.enemySide : context.allySide;

  return {
    subject: reactor,
    allies: allySide.filter(c => c.id !== reactor.id),
    enemies: enemySide,
    allySide,
    enemySide,
    inventory: reactorOnActorSide ? context.inventory : context.enemyInventory,
    enemyInventory: reactorOnActorSide ? context.enemyInventory : context.inventory,
    allyIds: new Set(allySide.map(c => c.id)),
    enemyIds: new Set(enemySide.map(c => c.id)),
  };
}