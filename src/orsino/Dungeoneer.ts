import Combat, { CombatContext } from "./Combat";
import { Team } from "./types/Team";
import Presenter from "./tui/Presenter";
import { Combatant } from "./types/Combatant";
import { Select } from "./types/Select";
import Words from "./tui/Words";
import Deem from "../deem";
import Files from "./util/Files";
import { Fighting } from "./rules/Fighting";
import { Roll } from "./types/Roll";
import Events, { DungeonEvent, EquipmentWornEvent } from "./Events";
import { Commands } from "./rules/Commands";
import CharacterRecord from "./rules/CharacterRecord";
import AbilityHandler, { Ability, AbilityEffect } from "./Ability";
import { Inventory } from "./Inventory";
import Orsino from "../orsino";
import { StatusEffect, StatusModifications } from "./Status";

type SkillType = "search" | "examine"; // | "disarm" | "pickLock" | "climb" | "swim" | "jump" | "listen" | "spot";

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

export default class Dungeoneer {
  static defaultTeam(): Team {
    return {
      name: "Party",
      combatants: [{
        forename: "Hero",
        name: "Hero",
        alignment: 'good',
        hp: 14, maxHp: 14, level: 1, ac: 10,
        dex: 11, str: 12, int: 10, wis: 10, cha: 10, con: 12,
        weapon: "Short Sword",
        hitDie: 8, attackDie: "1d20",
        playerControlled: true, xp: 0, gp: 0,
        abilities: ["melee", "defend"],
        traits: ["lucky"],
        damageKind: "slashing",
        hasMissileWeapon: false
      }],
      inventory: []
    };
  }

  static dungeonIcons = { temple: "🏛️", fortress: "🏯", library: "📚", tomb: "⚰️", mine: "⛏️", cave: "🕳️", crypt: "⚰️", tower: "🗼", }

  private dry: boolean = false;
  private roller: Roll;
  private select: Select<any>;
  // protected select: ChoiceSelector<any>;
  private outputSink: (message: string) => void;
  private currentRoomIndex: number = 0;
  private journal: DungeonEvent[] = [];

  protected dungeonGen: () => Promise<Dungeon>;
  protected encounterGen: (cr: number) => Promise<Encounter>;

  public playerTeam: Team;
  public dungeon: Dungeon | null = null;

  constructor(
    options: Record<string, any> = {}
  ) {
    this.dry = options.dry || Orsino.environment === 'test';
    this.roller = options.roller || Commands.roll;
    this.select = options.select || Combat.samplingSelect;
    this.outputSink = options.outputSink || console.log;
    this.dungeonGen = options.dungeonGen || Dungeoneer.defaultGen;
    this.playerTeam = options.playerTeam || Dungeoneer.defaultTeam();

    if (!this.dungeonGen) {
      throw new Error('dungeonGen is required');
    }

    // this.note(`Generated dungeon: ${this.dungeon.dungeon_name} (${this.dungeon.dungeon_type})`);

    this.encounterGen = (async (cr: number) => {
      if (options.gen) {
        return await options.gen("encounter", { race: this.dungeon!.race, terrain: this.dungeon!.terrain, targetCr: cr });
      } else {
        return {
          creatures: [
            { forename: "Goblin", name: "Goblin", hp: 7, maxHp: 7, level: 1, ac: 15, dex: 14, str: 8, con: 10, int: 10, wis: 8, cha: 8, attackDie: '1d6', damageKind: 'slashing', abilities: [], playerControlled: false, xp: 50, gp: 10, attackRolls: 1, weapon: "Dagger", alignment: 'evil', traits: [] } as Combatant
          ]
        }
      }
    });
  }

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
    return Dungeoneer.dungeonIcons[this.dungeon!.dungeon_type as keyof typeof Dungeoneer.dungeonIcons] || "🏰";
  }

  async setUp() {
    this.dungeon = await this.dungeonGen();
  }

  // Main run loop
  async run(): Promise<void> {
    if (!this.dungeon) {
      await this.setUp();
    }
    await this.presentCharacterRecords();

    await this.emit({
      type: "enterDungeon",
      dungeonName: this.dungeon!.dungeon_name,
      dungeonIcon: this.icon,
      dungeonType: this.dungeon!.dungeon_type,
      depth: this.dungeon!.depth,
      goal: this.dungeon!.goal || `Explore the ${this.dungeon!.dungeon_type} and defeat its denizens.`,
    });

    // assign dungeon environment to each combatants currentEnvironment
    this.playerTeam.combatants.forEach(c => c.currentEnvironment = this.dungeon!.terrain);

    while (!this.isOver()) {
      const room = this.currentRoom;
      if (!room) break;
      await this.enterRoom(room);
      let combat = undefined;
      if (this.currentEncounter && Combat.living(this.playerTeam.combatants).length > 0) {
        let survived = false;
        ({ playerWon: survived, combat } = await this.runCombat());
        if (!survived) break;
      }

      await this.emit({ type: "roomCleared", room, combat });
      let result = await this.roomActions(room);
      if (result.leaving) {
        // this.note(`\nYou decide to leave the dungeon.`);
        await this.emit({ type: "leaveDungeon" });
        return;
      }
      this.moveToNextRoom();
    }

    // Display outcome
    if (this.winner === 'Player') {
      this.emit({ type: "dungeonCleared", macguffin: this.dungeon!.macguffin });
      // this.note("\n🎉 Victory! Dungeon cleared!\n");
      if (this.dungeon!.macguffin) {
        // this.note(`You have secured ${Stylist.bold(this.dungeon!.macguffin)}!\n`);
        let isConsumable = await Deem.evaluate(`hasEntry(consumables, '${this.dungeon!.macguffin}')`);
        if (isConsumable) {
          // this.playerTeam.inventory[this.dungeon!.macguffin] = (this.playerTeam.inventory[this.dungeon!.macguffin] || 0) + 1;
          this.playerTeam.inventory.push(await Inventory.item(this.dungeon!.macguffin));
        } else {
          // add to loot 
          this.playerTeam.combatants[0].loot = this.playerTeam.combatants[0].loot || [];
          this.playerTeam.combatants[0].loot.push(this.dungeon!.macguffin);
        }
      }
    } else {
      // this.note("\n💀 Party defeated...\n");
      await this.emit({ type: "dungeonFailed", dungeonName: this.dungeon!.dungeon_name, reason: "Your party has been defeated." });
    }
  }

  async skillCheck(type: SkillType, action: string, stat: keyof Combatant, dc: number): Promise<{
    actor: Combatant;
    success: boolean;
  }> {
    const actor = await this.select(`Who will attempt ${action}?`, this.playerTeam.combatants.map(c => ({
      name: `${c.name} ${Presenter.stat(stat, c[stat])} (${Presenter.statMod(c[stat])})`,
      value: c,
      short: c.name,
      disabled: c.hp <= 0
    })));

    let actorFx = await Fighting.gatherEffects(actor);
    let skillBonusName = `${type}Bonus` as keyof StatusModifications;
    let skillBonus = actorFx[skillBonusName] as number || 0;
    let skillMod = Fighting.statMod(actor[stat] as number);

    // this.note(`${actor.name} attempts ${action} with modifier ${skillMod}` + (skillBonus > 0 ? ` and +${skillBonus} bonus.` : '.'));
    const roll = await this.roller(actor, action, 20);
    const total = roll.amount + skillMod + skillBonus;
    return { actor, success: total >= dc };
  }

  async presentCharacterRecords(): Promise<void> {
    for (const c of this.playerTeam.combatants) {
      await Presenter.printCharacterRecord(c);
    }
  }

  static dataPath = "./data"; // path.resolve(process.cwd() + "/data");

  // skipping for now -- running into cyclic structure issues :/
  private persistCharacterRecords(): void {
    for (const pc of this.playerTeam.combatants) {
      // write pc record to file (running into cyclic structure issues!!)
      let safePc = { ...pc, activeEffects: [], passiveEffects: [], activeSummonings: [] }; // will need to recompute effects on load...
      Files.write(`${Dungeoneer.dataPath}/pcs/${pc.name}.json`, JSON.stringify(safePc, null, 2));
    }
  }

  describeRoom(room: Room | BossRoom, verb: string = "are standing in"): string {
    let description = `You ${verb} ${Words.a_an(room.room_size)} ${room.narrative}`;
    if (room.decor === "nothing") {
      description += ` The ${Words.humanize(room.room_type)} contains simple furnishings`;
    } else {
      description += ` The ${Words.humanize(room.room_type)} contains ${room.decor!}`;
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


    let roomDescription = this.describeRoom(room, ["enter", "step into", "find yourself in"][Math.floor(Math.random() * 3)]);
    // this.note(Stylist.italic(roomDescription));
    await this.emit({ type: "enterRoom", roomDescription });

    // if (this.currentEncounter && Combat.living(this.currentEncounter.creatures).length > 0) {
    //   const monsters = this.currentEncounter.creatures.map(m => `\n - ${Presenter.combatant(m)}`).join("");
    //   this.note(`👹 Encounter: ${monsters}`);
    // }

    // display current party status
    // const partyStatus = this.playerTeam.combatants.map(c => Presenter.minimalCombatant(c)).join("\n");
    // this.note(`🧙‍ Party Status:\n${partyStatus}\n`);
  }

  private async runCombat(): Promise<{ playerWon: boolean, combat: Combat }> {
    if (Combat.living(this.currentMonsterTeam.combatants).length === 0) {
      return { playerWon: true, combat: null as any };
    }
    const combat = new Combat({
      roller: this.roller,
      select: this.select,
      note: this.outputSink
    });

    let roomAura = this.currentRoom?.aura;
    let roomName = Words.humanize(this.currentRoom?.room_type || `Room ${this.currentRoomIndex + 1}/${this.dungeon!.rooms.length + 1}`);
    await combat.setUp(
      [this.playerTeam, this.currentMonsterTeam],
      [this.dungeon!.dungeon_name, roomName].join(" - "),
      roomAura ? [roomAura] : [],
      this.dry
    );
    while (!combat.isOver()) {
      await combat.round(
        async (combatant: Combatant) => {
          // console.warn(`Combatant '${combatant.name}' has fled the combat.`);
          // find another room for them
          let newRoom = this.nextRoom;
          if (newRoom) {
            // this.note(`\n${combatant.name} escapes to the next room (${newRoom.room_type}).`);
            combatant.activeEffects = [];
            if ((newRoom as Room).encounter) {
              // console.log("New room creature count before escape:", (newRoom as Room).encounter?.creatures.length);
              (newRoom as Room).encounter?.creatures.push(combatant);
              // console.log("New room creature count after escape:", (newRoom as Room).encounter?.creatures.length);
            } else if ((newRoom as BossRoom).boss_encounter) {
              // console.log("New boss room creature count before escape:", (newRoom as BossRoom).boss_encounter?.creatures.length);
              (newRoom as BossRoom).boss_encounter?.creatures.push(combatant);
              // console.log("New boss room creature count after escape:", (newRoom as BossRoom).boss_encounter?.creatures.length);
            }
          // } else {
            // this.note(`\n${combatant.name} escapes the dungeon entirely!`);
          }
        }
      );
    }

    combat.tearDown();

    // console.log(`Combat complete. Winner: '${combat.winner}'`);

    Combat.statistics.victories += (combat.winner === this.playerTeam.name) ? 1 : 0;
    Combat.statistics.defeats += (combat.winner !== this.playerTeam.name) ? 1 : 0;

    // Award XP/gold
    if (combat.winner === this.playerTeam.name) {
      // const encounter = this.currentEncounter!;
      const enemies = combat.enemyCombatants || [];  //teams.find(t => t.name === "Enemies")?.combatants || [];

      let xp = 0;
      let gold = await Deem.evaluate(String(this.currentEncounter?.bonusGold || 0)) || 0;

      if (enemies.length > 0) {
        // this.note(`\n🎉 You defeated ${Words.humanizeList(enemies.map(e => e.name))}!`);

        let monsterCount = enemies.length;
        xp = enemies.reduce((sum, m) => sum + (m.xp || 0), 0)
          + (monsterCount * monsterCount * 10)
          + 25;

        // gold = (encounter.bonusGold || 0) +
        //   enemies.reduce((sum, m) => sum + (Deem.evaluate(String(m.gp) || "1+1d2")), 0);
        for (const m of enemies) {
          const monsterGold = (await Deem.evaluate(String(m.gp))) || 0;
          // console.log(`Monster '${m.name}' yields ${monsterGold} gold (${m.gp})`);
          gold += monsterGold;
        }

        // this.note(`\nVictory! +${xp} XP, +${gold} GP\n`);
      }

      let consumablesFound = Math.random();
      if (consumablesFound < 0.2) {
        let consumableRarity = (consumablesFound < 0.05) ? 'rare' : (consumablesFound < 0.1) ? 'uncommon' : 'common';
        let consumable = await Deem.evaluate(`pick(gather(consumables, -1, 'dig(#__it, rarity) == ${consumableRarity}'))`) as any;
        let consumableName = Words.humanize(consumable);
        // this.note(`You found ${Words.a_an(consumableName)} in the remains of your foes.`);
        await this.emit({ type: "itemFound", itemName: Words.humanize(consumableName), quantity: 1, where: "in the remains of your foes" });
        this.playerTeam.inventory.push(await Inventory.item(consumable));
        // if (consumable.charges) {
        //   this.playerTeam.inventory.push({ name: consumable, maxCharges: consumable.charges, charges: Math.random() * consumable.charges });
        // } else {
        //   this.playerTeam.inventory.push({ name: consumable });
        // }
        //[consumable] = (this.playerTeam.inventory[consumable] || 0) + 1;
        // this.playerTeam.inventory['minor_healing_potion'] = (this.playerTeam.inventory['minor_healing_potion'] || 0) + 1;
      }

      if (xp > 0 || gold > 0) {
        await this.reward(xp, gold);
      }
      return { playerWon: true, combat };
    }

    return { playerWon: false, combat };
  }

  private async reward(xp: number, gold: number): Promise<void> {
    let standing = Combat.living(this.playerTeam.combatants)
    let perCapitaXp = Math.floor(xp / standing.length);
    let perCapitaGold = Math.floor(gold / standing.length);
    for (const c of standing) {
      let fx = await Fighting.gatherEffects(c);
      let xpMultiplier = fx.xpMultiplier as number || 1;
      let gpMultiplier = fx.goldMultiplier as number || 1;

      c.xp = Math.round((c.xp || 0) + perCapitaXp * xpMultiplier);
      c.gp = Math.round((c.gp || 0) + perCapitaGold * gpMultiplier);

      if (xp > 0) {
        let events = await CharacterRecord.levelUp(c, this.playerTeam, this.roller, this.select);
        // events.forEach(e => this.emit({ ...e, turn: -1 } as DungeonEvent));
        for (const event of events) {
          await this.emit({ ...event } as DungeonEvent);
        }
      }
    }
  }

  // After clearing room
  private async roomActions(room: Room | BossRoom): Promise<{
    leaving: boolean
  }> {
    // this.note(this.describeRoom(room));

    let searched = false, examinedDecor = false, inspectedFeatures: string[] = [];
    let done = false;

    while (
      !done && Combat.living(this.playerTeam.combatants).length > 0
    ) {
      const options = [
        { name: "Move to next room", value: "move", short: 'Continue', disabled: false }, //room === this.dungeon!.bossRoom },
        { name: "Rest (stabilize unconscious party members, chance to use healing items, 30% encounter)", value: "rest", short: 'Rest', disabled: false },
        { name: "Search the room", value: "search", short: 'Search', disabled: searched },
        { name: "Review party status", value: "status", short: 'Status', disabled: false },
      ];
      if (room.decor && room.decor !== "nothing") {
        options.push({ name: `Examine ${Words.remove_article(room.decor!)}`, value: "examine", short: 'Examine', disabled: examinedDecor });
      }
      if (room.features && room.features.length > 0) {
        room.features.forEach(feature => {
          if (!inspectedFeatures.includes(feature)) {
            options.push({ name: `Inspect ${Words.humanize(feature)}`, value: `feature:${feature}`, short: 'Inspect', disabled: false });
          }
        });
      }
      if (room.shrine && !inspectedFeatures.includes('shrine')) {
        options.push({ name: `Pay respects to the shrine of ${Words.humanize(room.shrine.deity?.forename ?? 'a forgotten deity')}`, value: `feature:shrine`, short: 'Visit Shrine', disabled: false });
      }
      if (!this.dry) {
        options.push({ name: "Leave the dungeon", value: "leave", short: 'Leave', disabled: false });
      }

      let choice = await this.select("What would you like to do?", options);
      if (choice === "status") {
        for (const c of this.playerTeam.combatants) {
          await Presenter.printCharacterRecord(c);
        }
        this.outputSink(`Inventory:`);
        for (const [itemName, qty] of Object.entries(Inventory.quantities(this.playerTeam.inventory))) {
          if (qty > 1) {
            this.outputSink(` - ${Words.humanize(itemName)} x${qty}`);
          } else {
            this.outputSink(` - ${Words.humanize(itemName)}`);
          }
        }
      } else if (choice === "search") {
        await this.search(room);
        searched = true;
      } else if (choice === "rest") {
        const survivedNap = await this.rest(room);
        if (!survivedNap) {
          console.warn("The party was ambushed during their rest and defeated...");
          return { leaving: true };
        }
      } else if (choice === "examine") {
        let check = await this.skillCheck("examine", `to examine ${room.decor}`, "int", 15);
        let gp = 0;
        let items: string[] = [];
        if (check.success) {
          gp = await Deem.evaluate("1+1d20");
          items = await Deem.evaluate("sample(gather(consumables, -1, 'dig(#__it, rarity) == common'), 1d2)") as string[];
          // this.note(`${check.actor.forename} found a hidden compartment in ${room.decor} containing ${gp} gold coins!`);
        } else {
          // this.note(`${check.actor.forename} examined ${room.decor} thoroughly, but could find nothing out of the ordinary.`);
        }
        await this.emit({ type: "investigate", subject: check.actor, clue: `the ${room.decor}`, discovery: check.success ? `${gp} gold coins hidden within` : `nothing of interest` });
        await this.reward(0, gp);

        for (const item of items) {
          await this.emit({ type: "itemFound", itemName: Words.humanize(item), quantity: 1, where: `in the hidden compartment of ${room.decor}` });
          this.playerTeam.inventory.push(await Inventory.item(item));
        }
        examinedDecor = true;
      } else if (typeof choice === "string" && choice.startsWith("feature:")) {
        const featureName = choice.split(":")[1];
        await this.interactWithFeature(featureName);
        inspectedFeatures.push(featureName);
      }

      else if (choice === "leave") {
        const confirm = await this.select("Are you sure you want to leave the dungeon?", [
          { name: "Yes", value: "yes", short: 'Y', disabled: false },
          { name: "No", value: "no", short: 'N', disabled: false },
        ]);
        if (confirm === "yes") {
          return { leaving: true };
        }
      }
      else {
        done = true;
      }
    }
    return { leaving: Combat.living(this.playerTeam.combatants).length === 0 };
  }

  private async interactWithFeature(featureName: string): Promise<void> {
    let check = await this.skillCheck("examine", `to inspect ${Words.a_an(Words.humanize(featureName))}`, "int", 10);
    await this.emit({ type: "investigate", subject: check.actor, clue: `the ${Words.humanize(featureName)}`, discovery: check.success ? `an interesting feature` : `nothing of interest` });
    if (check.success) {
      let interaction = null;
      if (featureName === 'shrine' && this.currentRoom?.shrine) {
        interaction = this.currentRoom.shrine;
      } else {
        interaction = await Deem.evaluate(`=lookup(roomFeature, ${featureName})`) as Ability;
      }
      this.note(interaction.description);
      if (interaction.offer) {
        let gpCost = await Deem.evaluate(interaction.offer.toString());
        let totalGp = this.playerTeam.combatants.reduce((sum, c) => sum + (c.gp || 0), 0);

        let proceed = await this.select(`The ${Words.humanize(featureName)} offers ${Words.a_an(interaction.name)} for ${gpCost} gold. Purchase?`, [
          { name: "Yes", value: "yes", short: 'Y', disabled: gpCost > totalGp },
          { name: "No", value: "no", short: 'N', disabled: false },
        ]);
        if (proceed === "yes") {
          if (totalGp >= gpCost) {
            // deduct gp evenly from party members
            let gpPerMember = Math.ceil(gpCost / this.playerTeam.combatants.length);
            for (const c of this.playerTeam.combatants) {
              let deduction = Math.min(c.gp || 0, gpPerMember);
              c.gp = (c.gp || 0) - deduction;
              gpCost -= deduction;
              if (gpCost <= 0) break;
            }
            this.note(`Purchased ${interaction.name} from ${Words.humanize(featureName)}.`);
            let nullCombatContext: CombatContext = { subject: check.actor, allies: [], enemies: [] };
            for (let effect of interaction.effects) {
              // this.note(`Applying effect: ${JSON.stringify(effect)}`);
              let { events } = await AbilityHandler.handleEffect(interaction.name, effect, check.actor, check.actor, nullCombatContext, Commands.handlers(this.roller));
              // events.forEach(e => this.emit({ ...e, turn: -1 } as DungeonEvent));
              for (const event of events) {
                await this.emit(event as DungeonEvent);
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
  }

  private async search(room: Room | BossRoom): Promise<void> {
    let { actor, success } = await this.skillCheck("search", `to search the ${room.room_type.replaceAll("_", " ")}`, "wis", 15);
    await this.emit({ type: "investigate", subject: actor, clue: `the ${room.room_type.replaceAll("_", " ")}`, discovery: success ? `a hidden stash` : `nothing of interest` });
    if (success) {
      // this.note(`${actor.forename} finds a hidden stash!`);
      if (room.treasure) {
        for (const item of room.treasure) {
          // this.note(`You find ${Words.humanize(item)}`);
          await this.emit({ type: "itemFound", itemName: Words.humanize(item), quantity: 1, where: "in the hidden stash" });
          let isConsumable = await Deem.evaluate(`=hasEntry(consumables, "${item}")`) as boolean;
          let isGear = await Deem.evaluate(`=hasEntry(masterGear, "${item}")`) as boolean;
          let isEquipment = await Deem.evaluate(`=hasEntry(equipment, "${item}")`) as boolean;
          // let isGear = await Deem.evaluate(`=hasEntry(masterGear, "${item}")`) as boolean;
          if (isConsumable) {
            // this.note(`You add ${Words.a_an(item)} to your inventory.`);
            // this.playerTeam.inventory.push({ name: item });
            this.playerTeam.inventory.push(await Inventory.item(item));
          } else if (isGear) {
            // this.note(`${actor.forename} adds ${Words.a_an(item)} to their gear.`);
            actor.gear = actor.gear || [];
            actor.gear.push(item);
          } else if (isEquipment) {
            // this.note(`${actor.forename} may equip ${Words.a_an(item)}.`);
            let choice = await this.select(`Equip ${Words.humanize(item)} now?`, [
              { name: "Yes", value: "yes", short: 'Y', disabled: false },
              { name: "No", value: "no", short: 'N', disabled: false }
            ]);
            if (choice === "no") {
              this.note(`${actor.forename} puts ${Words.a_an(item)} in their loot.`);
              actor.loot = actor.loot || [];
              actor.loot.push(item);
              continue;
            }
            // add to combatant.equipment
            let { oldItemKey: maybeOldItem, slot } = await Inventory.equip(item, actor);
            if (maybeOldItem !== null) {
              this.note(`${actor.forename} replaces ${Words.a_an(maybeOldItem)} with ${Words.a_an(item)}.`);
              actor.loot = actor.loot || [];
              actor.loot.push(maybeOldItem);
            }
            await this.emit({ type: "equipmentWorn", itemName: item, slot, subject: actor } as EquipmentWornEvent);
          } else {
            // add to combatant.loot
            actor.loot = actor.loot || [];
            actor.loot.push(item);
          }
        }
        let xpReward = 10 + Math.floor(Math.random() * 20) + 5 * room.treasure.length;
        this.note(`+${xpReward} XP for finding the stash!`);
        await this.reward(xpReward, 0);
      }
      if (room.gear) {
        // this.note(`${actor.forename} finds ${Words.humanizeList(room.gear.map(Words.humanize))}!`);
        for (const item of room.gear) {
          await this.emit({ type: "itemFound", itemName: Words.humanize(item), quantity: 1, where: "in the hidden stash" });
          actor.gear = actor.gear || [];
          actor.gear.push(item);
        }
      }

      let lootBonus = 0;
      let fx = await Fighting.gatherEffects(actor);
      lootBonus += fx.lootBonus as number || 0;
      if (lootBonus > 0) {
        this.note(`${actor.forename} has a loot bonus of +${lootBonus}.`);
        let lootItems = await Deem.evaluate(`sample(gather(consumables, -1, 'dig(#__it, rarity) == common'), ${lootBonus})`) as string[];
        for (const item of lootItems) {
          // this.note(`You found ${Words.a_an(Words.humanize(item))}!`);
          // this.playerTeam.inventory[item] = (this.playerTeam.inventory[item] || 0) + 1;
          // this.playerTeam.inventory.push({ name: item });
          this.playerTeam.inventory.push(await Inventory.item(item));
          // this.note(`You add ${Words.a_an(Words.humanize(item))} to your inventory (total owned: ${this.playerTeam.inventory.filter(i => i.name === item).length})`);
          await this.emit({ type: "itemFound", itemName: Words.humanize(item), quantity: 1, where: "in the hidden stash" });

          // this.note(`You add ${Words.a_an(item)} to your bag. (Total owned: ${this.playerTeam.inventory[item]})`);
        }
      }

    // } else {
    //   this.note(`\n${actor.forename} fails to find anything.`);
    }
  }

  private async rest(_room: Room | BossRoom): Promise<boolean> {
    const choice = await this.select("Are you sure you want to rest in this room? (stabilize unconscious party members to 1HP, 30% encounter)", [
      { disabled: false, short: 'Y', name: "Yes", value: "yes" },
      { disabled: false, short: 'N', name: "No", value: "no" }
    ]);
    if (choice === "yes") {
      // Heal party, maybe trigger encounter
      this.note(`\n💤 Resting...`);
      let stabilizedCombatants: Combatant[] = [];
      for (const c of this.playerTeam.combatants) {
        if (c.hp <= 0) {
          c.hp = 1;
          stabilizedCombatants.push(c);
          this.note(`Stabilized ${c.name} at 1 HP.`);
        } // Stabilize unconscious characters
      }
      await this.emit({ type: "rest", stabilizedCombatants: stabilizedCombatants.map(c => c.name) });

      // ask if they want to use consumables/healing spells?
      let someoneWounded = this.playerTeam.combatants.some(c => c.hp < c.maxHp);

      let healingItems = [];
      let inventoryQuantities = Inventory.quantities(this.playerTeam.inventory);
        //Combat.inventoryQuantities(this.playerTeam);
      for (const [item, qty] of Object.entries(inventoryQuantities)) {
        let it = await Deem.evaluate(`=lookup(consumables, "${item}")`);
        if (qty > 0 && it.aspect === "healing") {
          healingItems.push(item);
        }
      };
      let hasHealingItems = healingItems.length > 0;
      if (hasHealingItems && someoneWounded) {
        let useItems = await this.select("Use healing items?", [
          { name: "Yes", value: "yes", short: 'Y', disabled: false },
          { name: "No", value: "no", short: 'N', disabled: false }
        ]);
        if (useItems === "yes") {
          for (const c of this.playerTeam.combatants) {
            if (c.hp < c.maxHp) {
              for (const itemName of healingItems) {
                // let qty = this.playerTeam.inventory[itemName] || 0;
                let qty = this.playerTeam.inventory.filter(i => i.name === itemName).length;
                if (qty > 0 && c.hp < c.maxHp) {
                  let it = await Deem.evaluate(`=lookup(consumables, "${itemName}")`);
                  let effects = it.effects;
                  let nullCombatContext: CombatContext = {
                    subject: c, allies: this.playerTeam.combatants.filter(ally => ally.name !== c.name && ally.hp > 0), enemies: [] };
                  for (let effect of effects) {
                    let { events } = await AbilityHandler.handleEffect(it.name, effect, c, c, nullCombatContext, Commands.handlers(this.roller));
                    // events.forEach(e => this.emit({ ...e, turn: -1 } as DungeonEvent));
                    for (const event of events) {
                      await this.emit({ ...event, turn: -1 } as DungeonEvent);
                    }
                  }
                  // consume one
                  let index = this.playerTeam.inventory.findIndex(i => i.name === itemName);
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
        let room = this.currentRoom as Room;
        room.encounter = await this.encounterGen(room.targetCr || 1);
        this.note(`\n👹 Wandering monsters interrupt your rest: ${Words.humanizeList(room.encounter.creatures.map(m => m.name))} [CR ${room.encounter.cr}]`);
        return (await this.runCombat()).playerWon;
      }
    }
    return true;
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
              forename: "Shadow Dragon", name: "Shadow Dragon", hp: 50, maxHp: 50, level: 5, ac: 18, dex: 14, str: 20, con: 16, int: 12, wis: 10, cha: 14,
              attackDie: "1d20", hitDie: 12, hasMissileWeapon: false,
              playerControlled: false, xp: 500, gp: 1000, weapon: "Bite", damageKind: "piercing", abilities: ["melee"], traits: [], alignment: 'evil'
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
          treasure: [ "a bag of gold coins", "a rusty sword" ],
          features: [],
          aura: null,
          decor: "a hidden alcove",
          gear: ["a rusty sword", "a bag of gold coins"],
          encounter: {
            cr: 1,
            creatures: [
              {
                forename: "Goblin", name: "Goblin", hp: 7, maxHp: 7, level: 1, ac: 15, dex: 14, str: 8, con: 10, int: 10, wis: 8, cha: 8, alignment: "evil",
                attackDie: "1d20", hitDie: 6, hasMissileWeapon: false,
                playerControlled: false, xp: 50, gp: 10, weapon: "Dagger", damageKind: "slashing", abilities: ["melee"], traits: []
              }
            ]
          },
          shrine: null
        },
        {
          narrative: "A grand hall with ancient tapestries.",
          room_type: 'hall',
          room_size: 'large',
          treasure: [ "a magical amulet", "a potion of healing" ],
          features: [],
          aura: null,
          decor: "a crumbling statue",
          gear: ["a magical amulet", "a potion of healing"],
          encounter: {
            cr: 2,
            creatures: [
              {
                forename: "Orc", name: "Orc", hp: 15, maxHp: 15, level: 2, ac: 13, dex: 12, str: 16, con: 14, int: 8, wis: 10, cha: 8, alignment: "evil",
                attackDie: "1d20", hitDie: 8, hasMissileWeapon: false,
                playerControlled: false, xp: 100, gp: 20, weapon: "Axe", damageKind: "slashing", abilities: ["melee"], traits: []
              },
            ]
          },
          shrine: null
        }
      ]
    }
  }

  get rooms(): Room[] {
    return this.dungeon!.rooms;
  }

  get currentRoom(): Room | BossRoom | null {
    if (this.currentRoomIndex < this.rooms.length) {
      return this.rooms[this.currentRoomIndex];
    } else if (this.currentRoomIndex === this.rooms.length) {
      return this.dungeon!.bossRoom;
    }
    return null;
  }

  get currentEncounter(): Encounter | null {
    const room = this.currentRoom;
    if (!room) return null;

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
      return this.dungeon!.bossRoom;
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
}
