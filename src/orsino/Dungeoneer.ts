import Combat from "./Combat";
import { CombatContext, pseudocontextFor } from "./types/CombatContext";
import { Team } from "./types/Team";
import Presenter from "./tui/Presenter";
import { Combatant, CombatantID } from "./types/Combatant";
import { Select } from "./types/Select";
import Words from "./tui/Words";
import Deem from "../deem";
import Files from "./util/Files";
import { Fighting } from "./rules/Fighting";
import { Roll } from "./types/Roll";
import Events, { DungeonEvent, EquipmentWornEvent, ItemFoundEvent, PlaneshiftEvent, TeleportEvent } from "./Events";
import { Commands } from "./rules/Commands";
import CharacterRecord from "./rules/CharacterRecord";
import AbilityHandler, { Ability, AbilityEffect } from "./Ability";
import { Inventory } from "./Inventory";
import Orsino from "../orsino";
import { StatusEffect, StatusModifications } from "./Status";
import Sample from "./util/Sample";
import Automatic from "./tui/Automatic";
import { ItemInstance } from "./types/ItemInstance";
import { GenerationTemplateType } from "./types/GenerationTemplateType";
import { GeneratedValue } from "./Generator";
import { Driver, NullDriver } from "./Driver";

type SkillType = "search" | "examine" | "disarm"; // | "pickLock" | "climb" | "swim" | "jump" | "listen" | "spot";

interface Encounter {
  creatures: Combatant[];
  bonusGold?: number;
  cr?: number;
}

type Domain = 'light' | 'darkness' | 'nature' | 'war' | 'knowledge' | 'trickery' | 'life' | 'death' | 'magic' | 'order' | 'chaos' | 'oceans' | 'love' | 'storms';

interface Deity {
  domain: Domain;
  alignment: 'good' | 'neutral' | 'evil';
  forename: string;
  gender: 'male' | 'female' | 'androgynous' | 'unknown';
  title: string;
  name: string;
}

interface RoomFeature {
  name: string;
  description: string;
  deity?: Deity;
  effects: AbilityEffect[];
  offer: number | string;
}

interface Riddle {
  difficulty: "easy" | "medium" | "hard" | "deadly";
  form: string;
  challenge: {
    answer_type: string; question: string; answer: string;
  };
  reward: ItemInstance;
}

interface Wonder {
  legendary: boolean;
  appearance: string;
  effects: AbilityEffect[];
  name: string;
  description: string;
  offer: number | string;
}

interface Trap {
  difficulty: 'easy' | 'medium' | 'hard' | 'deadly';
  name: string;
  effects: AbilityEffect[];
  trigger: string;
  lure: string;
  description: string;
  disarm_dc: number;
  detect_dc: number;
  punishment: string;
  punishmentDescription: string;
}

interface RoomBase {
  room_type: string;
  narrative: string;
  room_size: string;
  targetCr?: number;
  treasure: string[] | null;
  decor: string | null;
  gear: string[] | null;
  features: string[] | null;
  aura: StatusEffect | null;
  shrine: RoomFeature | null;
  riddle?: Riddle;
  wonder?: Wonder;
  trap?: Trap;

  completedFeatures?: string[];
  inspectedFeatures?: { [feature: string]: CombatantID[]; }
}

export interface Room extends RoomBase {
  encounter: Encounter | null;
}

export interface BossRoom extends RoomBase {
  boss_encounter: Encounter | null;
}

export interface Dungeon {
  macguffin?: string;
  terrain: "forest" | "cave" | "swamp" | "mountain" | "snow" | "desert";
  dungeon_type: string;
  race: string;
  theme: string;
  aspect: string;
  dungeon_name: string;
  depth: number;
  rooms: Room[];
  bossRoom: BossRoom;

  dungeonIndex?: number;
  rumor: string;
  direction: "north" | "south" | "east" | "west";
  intendedCr: number;

  goal?: string;
}

interface DungeoneerOptions {
  dry?: boolean;
  roller?: Roll;
  driver?: Driver;
  // select?: Select<any>;
  // outputSink?: (message: string) => void;
  dungeonGen?: () => Dungeon;
  gen?: (type: GenerationTemplateType, options?: Record<string, any>) => GeneratedValue | GeneratedValue[];
  playerTeam?: Team;
  // pause?: (message: string) => Promise<void>;
  // clear?: () => void;
}

export default class Dungeoneer {
  static dungeonIcons = { temple: "🏛️", fortress: "🏯", library: "📚", tomb: "⚰️", mine: "⛏️", cave: "🕳️", crypt: "⚰️", tower: "🗼", }

  private dry: boolean = false;
  private roller: Roll;
  private driver: Driver;
  // private select: Select<any>;
  // private pause: (message: string) => Promise<void>;
  // private clear: () => void = () => { };
  // // protected select: ChoiceSelector<any>;
  // private outputSink: (message: string) => void;
  private currentRoomIndex: number = 0;
  private journal: DungeonEvent[] = [];

  protected dungeonGen: () => Dungeon;
  protected encounterGen: (cr: number) => Encounter;

  public playerTeam: Team;
  private _dungeon: Dungeon | null = null;
  public get dungeon(): Dungeon {
    return this._dungeon!;
  }

  constructor(
    options: DungeoneerOptions = {}
  ) {
    this.dry = options.dry || Orsino.environment === 'test';
    this.roller = options.roller || Commands.roll.bind(Commands);
    this.dungeonGen = options.dungeonGen || Dungeoneer.defaultGen;
    this.playerTeam = options.playerTeam || Dungeoneer.defaultTeam();
    this.driver = options.driver || new NullDriver();

    // console.log(`Using driver: ${this.driver.description}`);

    if (!this.dungeonGen) {
      throw new Error('dungeonGen is required');
    }

    // this.note(`Generated dungeon: ${this.dungeon.dungeon_name} (${this.dungeon.dungeon_type})`);

    this.encounterGen = (cr: number) => {
      if (options.gen) {
        return options.gen("encounter", { race: this.dungeon.race, terrain: this.dungeon.terrain, targetCr: cr }) as unknown as Encounter;
      } else {
        return {
          creatures: [
            { id: 'npc:123', forename: "Goblin", name: "Goblin", hp: 7, maximumHitPoints: 7, level: 1, ac: 15, dex: 14, str: 8, con: 10, int: 10, wis: 8, cha: 8, attackDie: '1d6', damageKind: 'slashing', abilities: [], playerControlled: false, xp: 50, gp: 10, attackRolls: 1, weapon: "Dagger", alignment: 'evil', traits: [] } as Combatant
          ]
        }
      }
    }
  }

  protected get outputSink(): (message: string) => void { return this.driver.writeLn.bind(this.driver); }
  protected pause(message: string): void { this.driver.pause(message); }
  protected async select(message: string, choices: (readonly string[] | readonly { name: string; value: any; disabled?: boolean; short: string }[])): Promise<any> {
    return this.driver.select(message, choices);
  }
  protected clear(): void { this.driver.clear(); }

  private note(message: string): void {
    this.outputSink(message);
  }

  protected async emit(event: DungeonEvent) {
    this.journal.push(event);
    this.note(await Events.present(event));

    await Events.appendToLogfile(event);
  }

  // protected async emitAll(events: DungeonEvent[], message: string = "") {
  // }

  get icon() {
    return Dungeoneer.dungeonIcons[this.dungeon.dungeon_type as keyof typeof Dungeoneer.dungeonIcons] || "🏰";
  }

  setUp() {
    this._dungeon = this.dungeonGen();
  }

  // Main run loop
  async run(): Promise<{
    newPlane?: string
  }> {
    if (!this.dungeon) {
      this.setUp();
    }
    await this.presentCharacterRecords();

    await this.emit({
      type: "enterDungeon",
      dungeonName: this.dungeon.dungeon_name,
      dungeonIcon: this.icon,
      dungeonType: this.dungeon.dungeon_type,
      depth: this.dungeon.depth,
      goal: this.dungeon.goal || `Explore the ${this.dungeon.dungeon_type} and defeat its denizens.`,
    });

    // assign dungeon environment to each combatants currentEnvironment
    this.playerTeam.combatants.forEach(c => c.currentEnvironment = this.dungeon.terrain);
    // for (const c of this.playerTeam.combatants) {
    // acquire any testing items
    // await this.acquireItem(c, Inventory.materialize("robe_of_the_archmagi", []));
    // await this.acquireItem(c, Inventory.materialize("censer_of_consecration", []));
    // };

    while (!this.isOver()) {
      const room = this.currentRoom;
      if (!room) { break; }
      await this.enterRoom(room);
      let combat = undefined;
      if (this.currentEncounter && Combat.living(this.playerTeam.combatants).length > 0) {
        let survived = false;
        // ({ playerWon: survived, combat, newPlane } = await this.runCombat());
        const result = await this.runCombat();
        combat = result.combat;
        survived = result.playerWon;

        if (!survived) { break; }
        if (result.newPlane) {
          console.warn("Exiting dungeon due to planeshift...");
          return { newPlane: result.newPlane };
        }
      }

      await this.emit({ type: "roomCleared", room, combat });
      const result = await this.roomActions(room);
      if (result.leaving) {
        // this.note(`\nYou decide to leave the dungeon.`);
        await this.emit({ type: "leaveDungeon" });
        return { newPlane: result.newPlane };
      } else if (result.newLocation) {
        // we are moving to a new location within the dungeon (firstRoom, lastRoom, bossRoom, etc.)
        let newRoomIndex = -1;
        switch (result.newLocation) {
          case "firstRoom": newRoomIndex = 0; break;
          case "lastRoom": newRoomIndex = this.dungeon.rooms.length - 1; break;
          case "randomRoom": newRoomIndex = Math.floor(Math.random() * this.dungeon.rooms.length); break;
          default: newRoomIndex = Math.min(Math.max(0, parseInt(result.newLocation)), this.dungeon.rooms.length - 1); break;
        }
        if (newRoomIndex >= 0) {
          console.warn(`Moving to room index ${newRoomIndex} as per teleportation effect (was ${this.currentRoomIndex}).`);
          this.currentRoomIndex = newRoomIndex;
        }
      } else {
        this.moveToNextRoom();
      }
    }

    // Display outcome
    if (this.winner === 'Player') {
      await this.emit({ type: "dungeonCleared", macguffin: this.dungeon.macguffin });
      // this.note("\n🎉 Victory! Dungeon cleared!\n");
      if (this.dungeon.macguffin) {
        // this.note(`You have secured ${Stylist.bold(this.dungeon!.macguffin)}!\n`);
        // const isConsumable = Deem.evaluate(`hasEntry(consumables, '${this.dungeon!.macguffin}')`);
        // if (isConsumable) {
        // this.playerTeam.inventory[this.dungeon!.macguffin] = (this.playerTeam.inventory[this.dungeon!.macguffin] || 0) + 1;
        this.playerTeam.inventory.push(Inventory.genLoot(this.dungeon.macguffin));

      }
    } else {
      // this.note("\n💀 Party defeated...\n");
      await this.emit({ type: "dungeonFailed", dungeonName: this.dungeon.dungeon_name, reason: "Your party has been defeated." });
    }

    return {}
  }


  async skillCheck(type: SkillType, action: string, stat: keyof Combatant, dc: number, valid: (c: Combatant) => boolean = (): boolean => true): Promise<{
    actor: Combatant;
    success: boolean;
  }> {
    const validCombatants = this.playerTeam.combatants.filter(c => valid(c) && c.hp > 0);
    if (validCombatants.length === 0) {
      console.warn(`No valid combatants available for ${action}`);
      return { actor: this.playerTeam.combatants[0], success: false };
    }
    const actor = await this.select(`Who will attempt ${action}?`, validCombatants.map(c => ({
      name: `${c.name} ${Presenter.stat(stat, c[stat] as number)} (${Presenter.statMod(c[stat] as number)})`,
      value: c,
      short: c.name,
      disabled: c.hp <= 0
    }))) as Combatant;
    if (!actor) {
      // throw new Error(`No valid actor selected for ${action}`);
      console.warn(`No valid actor selected for ${action}`);
      return { actor: this.playerTeam.combatants[0], success: false };
    }

    const actorFx = Fighting.gatherEffects(actor);
    const skillBonusName = `${type}Bonus` as keyof StatusModifications;
    const skillBonus = actorFx[skillBonusName] as number || 0;
    const skillMod = Fighting.statMod(actor[stat] as number);

    // this.note(`${actor.name} attempts ${action} with modifier ${skillMod}` + (skillBonus > 0 ? ` and +${skillBonus} bonus.` : '.'));
    const mustRollValueOrHigher = dc - skillMod - skillBonus;
    const roll = this.roller(actor, action + ` (must roll ${mustRollValueOrHigher} or better)`, 20);
    const total = roll.amount + skillMod + skillBonus;
    return { actor, success: total >= dc };
  }

  async presentCharacterRecords(): Promise<void> {
    for (const c of this.playerTeam.combatants) {
      await Presenter.printCharacterRecord(c, this.playerTeam.inventory, this.outputSink);
    }
  }

  static dataPath = "./data";

  private persistCharacterRecords(): void {
    for (const pc of this.playerTeam.combatants) {
      const safePc = { ...pc, activeEffects: [], passiveEffects: [], activeSummonings: [] };
      Files.write(`${Dungeoneer.dataPath}/pcs/${pc.name}.json`, JSON.stringify(safePc, null, 2)).catch(err => {
        console.error(`Error writing character record for ${pc.name}:`, err);
      });
    }
  }

  describeRoom(room: Room | BossRoom, verb: string = "are standing in"): string {
    let description = `You ${verb} ${Words.a_an(room.room_size)} ${room.narrative}`;
    if (room.decor === "nothing") {
      description += ` The ${Words.humanize(room.room_type)} contains simple furnishings`;
    } else {
      description += ` The ${Words.humanize(room.room_type)} contains ${room.decor || "various furnishings"}`;
    }
    if (room.features && room.features.length > 0) {
      description += ` as well as ${Words.humanizeList(room.features.map(f => Words.a_an(Words.humanize(f))))}`;
    }
    description += '.';
    if (room.aura) {
      description += ` ${room.aura.description}.`;
    }
    return description;
  }

  async enterRoom(room: Room | BossRoom): Promise<void> {
    this.persistCharacterRecords();
    const roomDescription = this.describeRoom(room, ["enter", "step into", "find yourself in"][Math.floor(Math.random() * 3)]);
    await this.emit({ type: "enterRoom", roomDescription });
  }

  private async runCombat(): Promise<{ playerWon: boolean, combat: Combat, newPlane?: string }> {
    if (Combat.living(this.currentMonsterTeam.combatants).length === 0) {
      return { playerWon: true, combat: null as unknown as Combat };
    }
    const combat = new Combat({
      roller: this.roller,
      driver: this.driver,
      // select: this.select,
      // pause: this.pause,
      // clear: this.clear,
      // note: this.outputSink
    });

    const roomAura = this.currentRoom?.aura;
    const roomName = Words.humanize(this.currentRoom?.room_type || `Room ${this.currentRoomIndex + 1}/${this.dungeon.rooms.length + 1}`);
    await combat.setUp(
      [this.playerTeam, this.currentMonsterTeam],
      [this.dungeon.dungeon_name, roomName].join(" - "),
      roomAura ? [roomAura] : [],
      this.dry
    );
    while (!combat.isOver()) {
      const result = await combat.round(
        // flee callback
        async (combatant: Combatant) => {
          // find another room for them
          const newRoom = this.nextRoom;
          if (newRoom) {
            combatant.activeEffects = [];
            if ((newRoom as Room).encounter) {
              (newRoom as Room).encounter?.creatures.push(combatant);
            } else if ((newRoom as BossRoom).boss_encounter) {
              (newRoom as BossRoom).boss_encounter?.creatures.push(combatant);
            }
          }
        }
      );
      if (result.haltCombat) {
        console.warn("Combat halted; new plane? ", result.newPlane);
        return { playerWon: true, combat, newPlane: result.newPlane };
      }
    }

    combat.tearDown();

    Combat.statistics.victories += (combat.winner === this.playerTeam.name) ? 1 : 0;
    Combat.statistics.defeats += (combat.winner !== this.playerTeam.name) ? 1 : 0;

    // Award XP/gold
    if (combat.winner === this.playerTeam.name) {
      const enemies = combat.enemyCombatants || [];

      let xp = 0;
      let gold = Deem.evaluate(String(this.currentEncounter?.bonusGold || 0)) as number || 0;

      if (enemies.length > 0) {
        const monsterCount = enemies.length;
        xp = enemies.reduce((sum, m) => sum + (m.xp || 0), 0)
          + (monsterCount * monsterCount * 10)
          + 25;

        for (const m of enemies) {
          const monsterGold: number = Deem.evaluate(String(m.gp)) as number;
          gold += (monsterGold || 0);
        }

      }

      const consumablesFound = Math.random();
      if (consumablesFound < 0.2) {
        const consumableRarity = (consumablesFound < 0.05) ? 'rare' : (consumablesFound < 0.1) ? 'uncommon' : 'common';
        const consumable = Deem.evaluate(`pick(gather(consumables, -1, 'dig(#__it, rarity) == ${consumableRarity}'))`) as string;
        const it = Inventory.genLoot(consumable);
        const consumableName = Words.humanize(consumable);
        await this.emit(
          { type: "itemFound", subject: this.playerTeam.combatants[0], itemName: Words.humanize(consumableName), itemDescription: it.description || Words.a_an(Words.humanize(consumableName)), quantity: 1, where: "in the remains of your foes" } as ItemFoundEvent
        );
        this.playerTeam.inventory.push(it);
      }

      if (xp > 0 || gold > 0) {
        await this.reward(xp, gold);
      }
      return { playerWon: true, combat };
    }

    return { playerWon: false, combat };
  }

  private async reward(xp: number, gold: number): Promise<void> {
    const standing = Combat.living(this.playerTeam.combatants)
    const perCapitaXp = Math.floor(xp / standing.length);
    const perCapitaGold = Math.floor(gold / standing.length);
    for (const c of standing) {
      const fx = Fighting.gatherEffects(c);
      const xpMultiplier = fx.xpMultiplier as number || 1;
      const gpMultiplier = fx.goldMultiplier as number || 1;

      const xpGain = Math.round(perCapitaXp * xpMultiplier);
      c.xp = Math.round((c.xp || 0) + xpGain);
      await this.emit({ type: "xp", subject: c, amount: xpGain });

      const goldGain = Math.round(perCapitaGold * gpMultiplier);
      c.gp = Math.round((c.gp || 0) + goldGain);
      await this.emit({ type: "gold", subject: c, amount: goldGain });

      if (xp > 0) {
        const events = await CharacterRecord.levelUp(c, this.playerTeam, this.roller.bind(this), this.select.bind(this));
        for (const event of events) {
          await this.emit({ ...event } as DungeonEvent);
        }
      }
    }
  }

  private featureInspectedByAllMembers(room: RoomBase, feature: string): boolean {
    room.inspectedFeatures = room.inspectedFeatures || {};
    const inspectedBy = room.inspectedFeatures[feature] || [];
    const standingIds = Combat.living(this.playerTeam.combatants).map(c => c.id);
    return standingIds.every(id => inspectedBy.includes(id));
  }

  private featureDone(room: RoomBase, feature: string): boolean {
    const completedBy = room.completedFeatures || [];
    return completedBy.includes(feature) || this.featureInspectedByAllMembers(room, feature);
  }

  private memberHasNotInspectedFeature(room: RoomBase, feature: string, c: Combatant): boolean {
    room.inspectedFeatures = room.inspectedFeatures || {};
    const inspectedBy = room.inspectedFeatures[feature] || [];
    return !inspectedBy.includes(c.id);
  }

  // After clearing room
  private async roomActions(room: RoomBase): Promise<{
    leaving: boolean, newPlane?: string, newLocation?: string
  }> {
    // let searched = false, examinedDecor = false;
    // const inspectedFeatures: string[] = room.inspectedFeatures || [];
    let done = false;

    while (
      !done && Combat.living(this.playerTeam.combatants).length > 0
    ) {
      const options = [
        { name: "Move to next room", value: "move", short: 'Continue', disabled: false }, //room === this.dungeon!.bossRoom },
        { name: "Rest (stabilize unconscious party members, chance to use healing items, 30% encounter)", value: "rest", short: 'Rest', disabled: false },
        { name: "Search the room", value: "search", short: 'Search', disabled: this.featureDone(room, 'search') },
        { name: "Review party status", value: "status", short: 'Status', disabled: false },
      ];
      if (room.decor && room.decor !== "nothing") {
        options.push({
          name: `Examine ${Words.remove_article(room.decor)}`, value: "examine", short: 'Examine', disabled: this.featureDone(room, 'examine')
        });
      }
      if (room.trap) {
        options.push({
          name: `Examine ${Words.remove_article(room.trap.lure)}`, value: `trap`, short: 'Examine',
          disabled: this.featureDone(room, 'trap')
        });
      }
      if (room.features && room.features.length > 0) {
        room.features.forEach(feature => {
          // if (!inspectedFeatures.includes(feature)) {
          options.push({
            name: `Inspect ${Words.humanize(feature)}`, value: `feature:${feature}`, short: 'Inspect',
            disabled: this.featureDone(room, feature)
          });
          // }
        });
      }

      if (room.shrine) {
        options.push({
          name: `Pay respects to the shrine of ${Words.humanize(room.shrine.deity?.forename ?? 'a forgotten deity')}`, value: `feature:shrine`, short: 'Visit Shrine',
          disabled: this.featureDone(room, 'shrine')
        });
      }
      if (room.riddle) {
        options.push({
          name: `Inspect the curious ${Words.humanize(room.riddle.form)}`, value: "riddle", short: 'Solve Riddle', disabled: this.dry || this.featureDone(room, 'riddle')
        });
      }
      if (room.wonder) {
        options.push({ name: `Behold wondrous ${Words.humanize(room.wonder.appearance)}`, value: `feature:wonder`, short: 'Behold Wonder', disabled: this.featureDone(room, 'wonder') });
      }

      options.push({ name: "Leave the dungeon", value: "leave", short: 'Leave', disabled: this.dry });

      const choice = await this.select("What would you like to do?", options) as string;
      if (choice === "status") {
        for (const c of this.playerTeam.combatants) {
          let playerGear = Inventory.propertyOf(c, this.playerTeam.inventory);
          await Presenter.printCharacterRecord(c, playerGear, this.outputSink);
        }
        if (Object.keys(Inventory.quantities(this.playerTeam.inventory.filter(ii => ii.shared))).length > 0) {
          this.outputSink(`Inventory:`);
          for (const [itemName, qty] of Object.entries(Inventory.quantities(this.playerTeam.inventory.filter(ii => ii.shared)))) {
            if (qty > 1) {
              this.outputSink(` - ${Words.humanize(itemName)} x${qty}`);
            } else {
              this.outputSink(` - ${Words.humanize(itemName)}`);
            }
          }
        }
        this.outputSink("Gold: " + this.playerTeam.combatants.reduce((sum, c) => sum + (c.gp || 0), 0) + " gp");
      } else if (choice === "search") {
        const { searcherId, searchSuccessful } = await this.search(room);

        // searched = true;
        if (searchSuccessful) {
          room.completedFeatures = room.completedFeatures || [];
          room.completedFeatures.push('search');
        } else {
          room.inspectedFeatures = room.inspectedFeatures || {};
          room.inspectedFeatures['search'] = room.inspectedFeatures['search'] || [];
          room.inspectedFeatures['search'].push(searcherId);
        }
      } else if (choice === "rest") {
        const result = await this.rest(room);
        if (!result.survived) {
          // console.warn("The party was ambushed during their rest and defeated...");
          return { leaving: true };
        } else if (result.newPlane) {
          return { leaving: true, newPlane: result.newPlane };
        }
      } else if (choice === "examine") {
        const check = await this.skillCheck("examine", `to examine ${room.decor}`, "int", 15, (c) => this.memberHasNotInspectedFeature(room, 'examine', c));
        let gp = 0;
        let items: string[] = [];
        if (check.success) {
          gp = Deem.evaluate("1+1d20") as number;
          items = Deem.evaluate("sample(gather(consumables, -1, 'dig(#__it, rarity) == common'), 1d2)") as string[];
        }
        await this.emit({ type: "investigate", subject: check.actor, clue: `the ${room.decor}`, discovery: check.success ? `${gp} gold coins hidden within` : `nothing of interest` });
        await this.reward(0, gp);

        for (const item of items) {
          const it = Inventory.genLoot(item);
          let description = it.description || Words.a_an(Words.humanize(item));
          if (description.endsWith('.')) {
            description = description.slice(0, -1);
          }
          await this.emit({ type: "itemFound", subject: check.actor, itemName: Words.humanize(item), itemDescription: description, quantity: 1, where: `in the hidden compartment of ${room.decor}` });
          this.playerTeam.inventory.push(it);
        }
        // examinedDecor = true;
        if (check.success) {
          room.completedFeatures = room.completedFeatures || [];
          room.completedFeatures.push('examine');
        } else {
          room.inspectedFeatures = room.inspectedFeatures || {};
          room.inspectedFeatures['examine'] = room.inspectedFeatures['examine'] || [];
          room.inspectedFeatures['examine'].push(check.actor.id);
        }
      } else if (typeof choice === "string" && choice.startsWith("feature:")) {
        const featureName = choice.split(":")[1];
        const { leaving, newPlane, newLocation, interactorId, interactionDiscovered } = await this.interactWithFeature(featureName);
        // inspectedFeatures.push(featureName);

        room.inspectedFeatures = room.inspectedFeatures || {};
        room.inspectedFeatures[featureName] = room.inspectedFeatures[featureName] || [];
        room.inspectedFeatures[featureName].push(interactorId);

        if (interactionDiscovered) {
          room.completedFeatures = room.completedFeatures || [];
          room.completedFeatures.push(featureName);
        }

        if (leaving) {
          return { leaving, ...(newPlane ? { newPlane } : {}), ...(newLocation ? { newLocation } : {}) };
        }
      } else if (choice === "riddle") {
        const riddle = room.riddle;
        if (riddle) {
          const { solverId, riddleSolved } = await this.solveRiddle(riddle);
          room.inspectedFeatures = room.inspectedFeatures || {};
          room.inspectedFeatures['riddle'] = room.inspectedFeatures['riddle'] || [];
          room.inspectedFeatures['riddle'].push(solverId);
          if (riddleSolved) {
            room.completedFeatures = room.completedFeatures || [];
            room.completedFeatures.push('riddle');
          }
        }
      } else if (choice === "trap") {
        const trap = room.trap;
        if (trap) {
          // inspectedFeatures.push('trap');
          room.completedFeatures = room.completedFeatures || [];
          room.completedFeatures.push('trap');

          let result = await this.handleTrap(trap);
          if (!result.survived) {
            // console.warn("The party was defeated by the trap...");
            return { leaving: true };
          } else if (result.newLocation) {
            return { leaving: false, newLocation: result.newLocation };
          } else if (result.newPlane) {
            return { leaving: true, newPlane: result.newPlane };
          }
        }
      }

      else if (choice === "leave") {
        const confirm = await this.select("Are you sure you want to leave the dungeon?", [
          { name: "Yes", value: "yes", short: 'Y', disabled: false },
          { name: "No", value: "no", short: 'N', disabled: false },
        ]) as string;
        if (confirm === "yes") {
          return { leaving: true };
        }
      } else if (choice === "move") {
        done = true;
      }
      else {
        throw new Error(`Unknown room action choice: ${choice}`);
      }
    }
    return { leaving: Combat.living(this.playerTeam.combatants).length === 0 };
  }


  private async handleTrap(trap: Trap): Promise<{
    interactorId?: CombatantID;
    survived: boolean;
    newPlane?: string;
    newLocation?: string;
    leaving?: boolean;
  }> {
    let activated = false;
    const alertCheck = await this.skillCheck("examine", `to examine ${trap.lure}`, "int", trap.detect_dc);
    if (alertCheck.success) {
      await this.emit({ type: "trapDetected", trapDescription: trap.description, subject: alertCheck.actor });

      const inventoryQuantities = Inventory.quantities(this.playerTeam.inventory);
      let toolsAvailable = false;
      if (inventoryQuantities['thieves_tools'] && inventoryQuantities['thieves_tools'] > 0) {
        toolsAvailable = true;
      }

      // const hasTools = this.playerTeam.combatants.some(c => c.gear?.includes('thieves_tools'));
      if (!toolsAvailable) {
        this.note(`But no one has thieves' tools to disarm it! You carefully avoid the ${Words.humanize(trap.trigger)} and move on.`);
        return { survived: true };
      }

      const disarmCheck = await this.skillCheck("disarm", `to disarm the trap`, "dex", trap.disarm_dc); //, (c) => c.gear?.includes('thieves_tools') || false);
      activated = !disarmCheck.success;

      if (disarmCheck.success) {
        await this.emit({ type: "trapDisarmed", trapDescription: trap.description, success: disarmCheck.success, subject: disarmCheck.actor, trigger: trap.trigger });
        const disarmExperienceReward = { easy: 100, medium: 150, hard: 250, deadly: 400 };
        await this.reward(disarmExperienceReward[trap.difficulty], 0);
      }
    } else {
      activated = true;
    }

    if (activated) {
      await this.emit({ type: "trapTriggered", trigger: trap.trigger, trapDescription: trap.description, punishmentDescription: trap.punishmentDescription, subject: alertCheck.actor });
      // apply trap effects
      const fx = trap.effects;
      const trapPseudocombatant: Combatant = {
        id: `trap:${trap.name.toLowerCase().replace(/\s+/g, '_')}`,
        forename: Words.humanize(trap.punishment),
        name: trap.punishment,
        alignment: 'neutral',
        equipment: { weapon: '', body: '' },
        hp: 1, maximumHitPoints: 1, level: 0,
        dex: 0, str: 0, int: 0, wis: 0, cha: 0, con: 0,
        abilities: [], playerControlled: false, xp: 0, gp: 0, traits: []
      };
      for (const pc of this.playerTeam.combatants) {
        const context: CombatContext = pseudocontextFor(pc, this.playerTeam.inventory);
        const source = Words.a_an(Words.humanize(trap.punishment));
        for (const effect of fx) {
          const { events } = await AbilityHandler.handleEffect(source, effect, trapPseudocombatant, pc, context, Commands.handlers(this.roller));
          for (const event of events) {
            await this.emit({ ...event, source: trap.name } as DungeonEvent);
            if (event.type === "teleport") {
              return { interactorId: alertCheck.actor.id, leaving: false, newLocation: (event as TeleportEvent).location, survived: true };
            } else if (event.type === "planeshift") {
              return { interactorId: alertCheck.actor.id, leaving: true, newPlane: (event as PlaneshiftEvent).plane, survived: true};
            }
          }
        }
      }
    }
    return { survived: Combat.living(this.playerTeam.combatants).length > 0 };
  }

  private async solveRiddle(riddle: Riddle): Promise<{
    solverId: CombatantID,
    riddleSolved: boolean,
  }> {
    const dc = (riddle.difficulty === "easy") ? 10 : (riddle.difficulty === "medium") ? 15 : (riddle.difficulty === "hard") ? 20 : 25
    const check = await this.skillCheck("examine",
      `to understand the ${Words.humanize(riddle.form)}`, "int", dc,
      (c) => this.memberHasNotInspectedFeature(this.currentRoom as RoomBase, 'riddle', c)
    );
    let solved = false;

    if (check.success) {
      const wrongAnswerPool = Deem.evaluate(`lookup(riddleAnswerGroups, ${riddle.challenge.answer_type})`) as string[];
      wrongAnswerPool.splice(wrongAnswerPool.indexOf(riddle.challenge.answer), 1); // remove correct answer from wrong answer pool
      await this.emit({ type: "riddlePosed", subject: check.actor, challenge: riddle.challenge.question });
      const answer = await this.select(`The ${Words.humanize(riddle.form)} awaits your answer...`, [
        ...Sample.shuffle(...[
          { name: riddle.challenge.answer, value: "correct", short: 'Answer', disabled: false },
          ...(Sample.count(5, ...wrongAnswerPool).map((name) => ({ name, value: 'wrong', short: 'Answer', disabled: false })))
        ]),
        { name: "Remain silent", value: "silent", short: 'Silent', disabled: false },
      ]) as string;
      if (answer === "correct") {
        solved = true;
        await this.emit({ type: "riddleSolved", subject: check.actor, challenge: riddle.challenge.question, reward: riddle.reward, solution: riddle.challenge.answer });
        // this.playerTeam.inventory.push(riddle.reward);
        await this.acquireItem(check.actor, riddle.reward, `as a reward for solving the ${Words.humanize(riddle.form)}`);

        // xp gain
        const xpGain = (riddle.difficulty === "easy") ? 100 : (riddle.difficulty === "medium") ? 250 : (riddle.difficulty === "hard") ? 500 : 1000;
        await this.reward(xpGain, 0);
      } else {
        this.note(`${check.actor.forename} answered incorrectly.`);
      }
    } else {
      this.note(`${check.actor.forename} could not make sense of the ${Words.humanize(riddle.form)}.`);
    }
    return { solverId: check.actor.id, riddleSolved: solved };
  }

  private async interactWithFeature(featureName: string): Promise<{
    interactorId: CombatantID,
    interactionDiscovered?: boolean,
    leaving: boolean,
    newLocation?: string,
    newPlane?: string
  }> {
    // console.log(`Interacting with feature: ${featureName}`);
    let successful = false;
    const check = await this.skillCheck("examine", `to inspect ${Words.a_an(Words.humanize(featureName))}`, "int", 10, (c) => this.memberHasNotInspectedFeature(this.currentRoom as RoomBase, featureName, c));
    await this.emit({ type: "investigate", subject: check.actor, clue: `the ${Words.humanize(featureName)}`, discovery: check.success ? `an interesting feature` : `nothing of interest` });
    if (check.success) {
      successful = true;
      let interaction = null;
      if (featureName === 'shrine' && this.currentRoom?.shrine) {
        interaction = this.currentRoom.shrine;
      } else if (featureName === 'wonder' && this.currentRoom?.wonder) {
        interaction = this.currentRoom.wonder;
      } else {
        interaction = Deem.evaluate(`=lookup(roomFeature, ${featureName})`) as unknown as Ability;
      }
      this.note(interaction.description);
      if (interaction.offer) {
        let gpCost = Deem.evaluate(interaction.offer.toString()) as number;
        const totalGp = this.playerTeam.combatants.reduce((sum, c) => sum + (c.gp || 0), 0);

        const proceed = await this.select(`The ${Words.humanize(featureName)} offers ${Words.a_an(interaction.name)} for ${gpCost} gold. Purchase?`, [
          { name: "Yes", value: "yes", short: 'Y', disabled: gpCost > totalGp },
          { name: "No", value: "no", short: 'N', disabled: false },
        ]) as string;
        if (proceed === "yes") {
          if (totalGp >= gpCost) {
            // deduct gp evenly from party members
            const gpPerMember = Math.ceil(gpCost / this.playerTeam.combatants.length);
            for (const c of this.playerTeam.combatants) {
              const deduction = Math.min(c.gp || 0, gpPerMember);
              c.gp = (c.gp || 0) - deduction;
              gpCost -= deduction;
              if (gpCost <= 0) { break; }
            }
            this.note(`Purchased ${interaction.name} from ${Words.humanize(featureName)}.`);
            const nullCombatContext: CombatContext = pseudocontextFor(check.actor, this.playerTeam.inventory);
            //   subject: check.actor, allies: [
            //     ...this.playerTeam.combatants.filter(c => c !== check.actor)
            //   ], enemies: [],
            //   inventory: this.playerTeam.inventory, enemyInventory: [],
            //   allyIds: new Set(this.playerTeam.combatants.map(c => c.id)),
            //   enemyIds: new Set(),
            // };
            for (const effect of interaction.effects) {
              const { events } = await AbilityHandler.handleEffect(interaction.name, effect, check.actor, check.actor, nullCombatContext, Commands.handlers(this.roller));
              for (const event of events) {
                await this.emit(event as DungeonEvent);
                if (event.type === "teleport") {
                  return { interactorId: check.actor.id, leaving: false, newLocation: (event as TeleportEvent).location, interactionDiscovered: true };
                } else if (event.type === "planeshift") {
                  return { interactorId: check.actor.id, leaving: true, newPlane: (event as PlaneshiftEvent).plane, interactionDiscovered: true };
                }
              }
            }
          }
        } else {
          this.note(`Decided not to offer anything to the ${Words.humanize(featureName)}.`);
        }
      }
    } else {
      this.note(`${check.actor.forename} inspected ${Words.humanize(featureName)}, but could find nothing of interest.`);
    }
    return { interactorId: check.actor.id, leaving: false, interactionDiscovered: successful };
  }

  private async search(room: RoomBase): Promise<{
    searcherId: CombatantID,
    searchSuccessful: boolean
  }> {
    const { actor, success } = await this.skillCheck("search", `to search the ${room.room_type.replaceAll("_", " ")}`, "wis", 15,
      (c) => this.memberHasNotInspectedFeature(room, 'search', c)
    );
    await this.emit({ type: "investigate", subject: actor, clue: `the ${room.room_type.replaceAll("_", " ")}`, discovery: success ? `a hidden stash` : `nothing of interest` });
    if (success) {
      if (room.gear) {
        for (const item of room.gear) {
          const it = Inventory.genLoot(item);
          this.playerTeam.inventory.push(it);
          let description = it.description || Words.a_an(Words.humanize(item));
          if (description.endsWith('.')) {
            description = description.slice(0, -1);
          }
          await this.emit({ type: "itemFound", subject: actor, itemName: Words.humanize(item), itemDescription: description, quantity: 1, where: "in the hidden stash" });
        }
      }

      let lootBonus = 0;
      const fx = Fighting.gatherEffects(actor);
      lootBonus += fx.lootBonus as number || 0;
      if (lootBonus > 0) {
        this.note(`${actor.forename} has a loot bonus of +${lootBonus}.`);
        const lootItems = Deem.evaluate(`sample(gather(consumables, -1, 'dig(#__it, rarity) == common'), ${lootBonus})`) as string[];
        for (const item of lootItems) {
          const it = Inventory.genLoot(item);
          this.playerTeam.inventory.push(it);
          let description = it.description || Words.a_an(Words.humanize(item));
          if (description.endsWith('.')) {
            description = description.slice(0, -1);
          }
          await this.emit({ type: "itemFound", subject: actor, itemName: Words.humanize(item), itemDescription: description, quantity: 1, where: "in the hidden stash" });
        }
      }

      if (room.treasure) {
        for (const item of room.treasure) {
          const it = Inventory.genLoot(item);
          await this.acquireItem(actor, it, "in the hidden stash")
        }
        const xpReward = 10 + Math.floor(Math.random() * 20) + 5 * room.treasure.length;
        this.note(`+${xpReward} XP for finding the stash!`);
        await this.reward(xpReward, 0);
      }
    }
    return { searcherId: actor.id, searchSuccessful: success };
  }

  private async rest(_room: RoomBase): Promise<{
    survived: boolean,
    newPlane?: string
  }> {
    const choice = await this.select("Are you sure you want to rest in this room? (chance to stabilize unconscious party members to 1HP, 30% encounter)", [
      { disabled: false, short: 'Y', name: "Yes", value: "yes" },
      { disabled: false, short: 'N', name: "No", value: "no" }
    ]) as string;
    if (choice === "yes") {
      // Heal party, maybe trigger encounter
      this.note(`\n💤 Resting...`);
      const stabilizedCombatants: Combatant[] = [];
      for (const c of this.playerTeam.combatants) {
        if (c.hp <= 0 && c.dead !== true) {
          let systemShockDc = 10;
          const conMod = Fighting.statMod(c.con as number);
          systemShockDc += conMod;
          const systemShockRoll = this.roller(c, `System Shock Save (DC ${systemShockDc})`, 20);
          const total = systemShockRoll.amount;
          if (total >= systemShockDc) {
            this.note(`${c.name} succeeded on their System Shock save (${systemShockRoll.amount} + ${conMod} = ${total} >= ${systemShockDc}).`);
          } else {
            this.note(`${c.name} failed their System Shock save (${systemShockRoll.amount} + ${conMod} = ${total} < ${systemShockDc}) and has bled out!`);
            c.dead = true;
            c.hp = -10;
            continue; // remains unconscious
          }
          c.hp = 1;
          stabilizedCombatants.push(c);
          this.note(`Stabilized ${c.name} at 1 HP.`);
        } // Stabilize unconscious characters
      }
      await this.emit({ type: "rest", stabilizedCombatants: stabilizedCombatants.map(c => c.name) });

      // ask if they want to use consumables/healing spells?
      const someoneWounded = this.playerTeam.combatants.some(c => {
        const effective = Fighting.effectiveStats(c);
        return c.hp < effective.maxHp && c.hp > 0;
      });

      const healingItems = [];
      const inventoryQuantities = Inventory.quantities(this.playerTeam.inventory);
      //Combat.inventoryQuantities(this.playerTeam);
      for (const [item, qty] of Object.entries(inventoryQuantities)) {
        // const it = Deem.evaluate(`=lookup(consumables, "${item}")`) as unknown as ItemInstance;
        const it = this.playerTeam.inventory.find(i => i.key === item) as ItemInstance;
        if (qty > 0 && it && it.aspect === "healing") {
          healingItems.push(item);
        }
      };
      const hasHealingItems = healingItems.length > 0;
      if (hasHealingItems && someoneWounded) {
        const useItems = await this.select("Use healing items?", [
          { name: "Yes", value: "yes", short: 'Y', disabled: false },
          { name: "No", value: "no", short: 'N', disabled: false }
        ]) as string;
        if (useItems === "yes") {
          for (const c of this.playerTeam.combatants) {
            const effective = Fighting.effectiveStats(c);
            if (c.hp < effective.maxHp && c.hp > 0) {
              for (const itemName of healingItems) {
                // let qty = this.playerTeam.inventory[itemName] || 0;
                const qty = this.playerTeam.inventory.filter(i => i.key === itemName).length;
                if (qty > 0 && c.hp < effective.maxHp) {
                  // const it = Deem.evaluate(`=lookup(consumables, "${itemName}")`);
                  const it = this.playerTeam.inventory.find(i => i.key === itemName) as ItemInstance;
                  this.note(`Using ${Words.a_an(itemName)} on ${c.name}...`);
                  const effects = it.effects || [];
                  const nullCombatContext: CombatContext = pseudocontextFor(c, this.playerTeam.inventory);
                  for (const effect of effects) {
                    const { events } = await AbilityHandler.handleEffect(it.name, effect, c, c, nullCombatContext, Commands.handlers(this.roller));
                    // events.forEach(e => this.emit({ ...e, turn: -1 } as DungeonEvent));
                    for (const event of events) {
                      await this.emit({ ...event, turn: -1 } as DungeonEvent);
                    }
                  }
                  // consume one
                  const index = this.playerTeam.inventory.findIndex(i => i.name === itemName);
                  if (index >= 0) {
                    this.playerTeam.inventory.splice(index, 1);
                  }
                }
              }
            }
          }
        }
      }

      if (Math.random() < 0.3 && this.currentRoomIndex < this.rooms.length) {
        // let encounter = this.encounterGen...
        const room = this.currentRoom as Room;
        room.encounter = this.encounterGen(room.targetCr || 1);
        this.note(`\n👹 Wandering monsters interrupt your rest: ${Words.humanizeList(room.encounter.creatures.map(m => m.name))} [CR ${room.encounter.cr}]`);
        const result = (await this.runCombat()); //.playerWon;
        if (!result.playerWon) {
          return { survived: false };
        } else if (result.newPlane) {
          return { survived: true, newPlane: result.newPlane };
        }
      }
    }
    return { survived: true };
  }


  private async acquireItem(actor: Combatant, it: ItemInstance, where: string = "found"): Promise<void> {
    if (!it.id) {
      throw new Error(`acquireItem got item without id: ${it.key}`);
    } else if (!it.id.includes(':')) {
      throw new Error(`acquireItem got item with non-id id: ${it.id}`);
    }

    Inventory.assertItemRef(it.id, "acquireItem " + it.name + " for " + actor.name);

    this.playerTeam.inventory.push(it);

    const isEquipment = it.itemClass === "equipment";
    const isWeapon = it.itemClass === "weapon";
    const isArmor = it.itemClass === "armor";

    let description = it.description || Words.a_an(Words.humanize(it.key));
    if (description.endsWith('.')) {
      description = description.slice(0, -1);
    }
    await this.emit({ type: "itemFound", subject: actor, itemName: Words.humanize(it.name), itemDescription: description, quantity: 1, where });

    if (isEquipment || isWeapon || isArmor) {
      const choice = await this.select(`Equip ${Words.humanize(it.name)} now?`, [
        { name: "Yes", value: "yes", short: 'Y', disabled: false },
        { name: "No", value: "no", short: 'N', disabled: false }
      ]) as string;
      if (choice === "no") {
        return;
      }
      const { oldItemRef: oldItem, slot } = Inventory.equipmentSlotAndExistingItem(it, actor, this.playerTeam.inventory);
      if (oldItem !== null) {
        if (oldItem.kind === "id") { // it must exist in inventory
          const exists = this.playerTeam.inventory.some(i => i.id === oldItem.id);
          if (!exists) {
            throw new Error(`Equipped item id missing from inventory: ${oldItem.id}`);
          }
        } else { // equipment stored a key like "longsword"
          const alreadyReified = this.playerTeam.inventory.some(i => i.key === oldItem.key);
          if (!alreadyReified) {
            const reifiedOldItem = Inventory.reifyFromKey(oldItem.key.toLocaleLowerCase());
            this.playerTeam.inventory.push(reifiedOldItem);
          }
        }

      }
      await this.emit({ type: "equipmentWorn", itemName: it.name, slot, subject: actor } as EquipmentWornEvent);

      it.ownerId = actor.id;
      it.ownerSlot = slot;

      // clear any other inventory of this ownerSlot for this actor
      for (const invItem of this.playerTeam.inventory) {
        if (invItem.ownerId === actor.id && invItem.ownerSlot === slot && invItem.id !== it.id) {
          invItem.ownerSlot = undefined;
        }
      }
      actor.equipment = actor.equipment || {};
      this.outputSink(`${actor.forename} equips ${Words.a_an(it.name)} (id: ${it.id}).`);
      actor.equipment[slot] = it.id;
      // console.log(`!!! Equipping ${it.id} to ${actor.name} in slot ${slot}`);
    }
  }

  get rooms(): Room[] {
    return this.dungeon.rooms;
  }

  get currentRoom(): Room | BossRoom | null {
    if (this.currentRoomIndex < this.rooms.length) {
      return this.rooms[this.currentRoomIndex];
    } else if (this.currentRoomIndex === this.rooms.length) {
      return this.dungeon.bossRoom;
    }
    return null;
  }

  get currentEncounter(): Encounter | null {
    const room = this.currentRoom;
    if (!room) { return null; }

    // Boss room uses boss_encounter
    if ('boss_encounter' in room) {
      return room.boss_encounter;
    }

    return room.encounter;
  }

  get currentMonsterTeam(): Team {
    const encounter = this.currentEncounter;
    return {
      name: "Enemies",
      combatants: encounter?.creatures || [],
      inventory: []
      // healingPotions: 0
    };
  }

  get isBossRoom(): boolean {
    return this.currentRoomIndex === this.rooms.length;
  }

  get nextRoom(): Room | BossRoom | null {
    const nextIndex = this.currentRoomIndex + 1;
    if (nextIndex < this.rooms.length) {
      return this.rooms[nextIndex];
    } else if (nextIndex === this.rooms.length) {
      return this.dungeon.bossRoom;
    }
    return null;
  }

  moveToNextRoom(): Room | BossRoom | null {
    this.currentRoomIndex++;
    return this.currentRoom;
  }

  isOver(): boolean {
    const partyDead = this.playerTeam.combatants.every(c => c.hp <= 0);
    const dungeonComplete = this.currentRoomIndex > this.rooms.length; // Past boss room
    return partyDead || dungeonComplete;
  }

  get winner(): 'Player' | 'Enemy' | null {
    if (this.playerTeam.combatants.every(c => c.hp <= 0)) {
      return 'Enemy';
    } else if (this.currentRoomIndex > this.rooms.length) {
      return 'Player';
    }
    return null;
  }

  static defaultGen(): Dungeon {
    return {
      dungeon_name: 'The Cursed Caverns',
      terrain: 'cave',
      rumor: 'A dark cave rumored to be home to a fearsome Shadow Dragon.',
      direction: 'north',
      intendedCr: 3,
      depth: 2,
      dungeon_type: 'cave',
      race: 'dwarven',
      theme: 'underground',
      aspect: 'dark',
      bossRoom: {
        narrative: "A shadowy chamber with a towering figure.",
        room_size: 'large',
        room_type: 'boss lair',
        targetCr: 5,
        boss_encounter: {
          cr: 5,
          creatures: [
            {
              id: "npc:shadow_dragon_001",
              forename: "Shadow Dragon", name: "Shadow Dragon", hp: 50, maximumHitPoints: 50, level: 5,
              dex: 14, str: 20, con: 16, int: 12, wis: 10, cha: 14,
              playerControlled: false, xp: 500, gp: 1000,
              equipment: { weapon: "bite", body: "scale" },
              abilities: ["melee"], traits: [], alignment: 'evil'
            }
          ]
        },
        treasure: ["a legendary sword"],
        features: [],
        aura: null,
        decor: "a magical portal",
        gear: ["a legendary sword"],
        shrine: null
      },
      rooms: [
        {
          narrative: "A dimly lit cave with dripping water.",
          room_type: 'cave',
          room_size: 'small',
          treasure: ["a bag of gold coins", "a rusty sword"],
          features: [],
          aura: null,
          decor: "a hidden alcove",
          gear: ["a rusty sword", "a bag of gold coins"],
          encounter: {
            cr: 1,
            creatures: [
              {
                id: "npc:goblin_001",
                forename: "Goblin", name: "Goblin", hp: 7, maximumHitPoints: 7, level: 1, dex: 14, str: 8, con: 10, int: 10, wis: 8, cha: 8, alignment: "evil",
                playerControlled: false, xp: 50, gp: 10,
                equipment: { weapon: "dagger", body: "scale" },
                abilities: ["melee"], traits: []
              }
            ]
          },
          shrine: null
        },
        {
          narrative: "A grand hall with ancient tapestries.",
          room_type: 'hall',
          room_size: 'large',
          treasure: ["a magical amulet", "a potion of healing"],
          features: [],
          aura: null,
          decor: "a crumbling statue",
          gear: ["a magical amulet", "a potion of healing"],
          encounter: {
            cr: 2,
            creatures: [
              {
                id: "npc:orc_001",
                forename: "Orc", name: "Orc", hp: 15, maximumHitPoints: 15, level: 2, dex: 12, str: 16, con: 14, int: 8, wis: 10, cha: 8, alignment: "evil",
                playerControlled: false, xp: 100, gp: 20,
                equipment: { weapon: "axe", body: "leather" },
                abilities: ["melee"], traits: []
              },
            ]
          },
          shrine: null
        }
      ]
    }
  }

  static defaultTeam(): Team {
    return {
      name: "Party",
      combatants: [{
        id: "pc:hero",
        forename: "Hero",
        name: "Hero",
        alignment: 'good',
        hp: 14, maximumHitPoints: 14, level: 1, // ac: 10,
        dex: 11, str: 12, int: 10, wis: 10, cha: 10, con: 12,
        equipment: { weapon: "shortsword", body: "chainmail" },
        hitDie: 8,
        playerControlled: true, xp: 0, gp: 0,
        abilities: ["melee", "defend"],
        traits: ["lucky"]
      }],
      inventory: []
    };
  }
}
