import Combat from "./Combat";
import { Team } from "./types/Team";
import Presenter from "./tui/Presenter";
import { Combatant } from "./types/Combatant";
import { Select } from "./types/Select";
import Words from "./tui/Words";
import Stylist from "./tui/Style";
import Deem from "../deem";
import Files from "./util/Files";
import { Fighting } from "./rules/Fighting";
import { Roll } from "./types/Roll";
import Events, { DungeonEvent } from "./Events";
import { Commands } from "./rules/Commands";
import CharacterRecord from "./rules/CharacterRecord";

type SkillType = "search" | "examine"; // | "disarm" | "pickLock" | "climb" | "swim" | "jump" | "listen" | "spot";

interface Encounter {
  creatures: Combatant[];
  bonusGold?: number;
  cr?: number;
}

export interface Room {
  room_type: string;
  narrative: string;
  room_size: string;
  targetCr?: number;
  treasure: string | null;
  encounter: Encounter | null;
  feature: string | null;
}

export interface BossRoom {
  narrative: string;
  room_size: string;
  room_type: string;
  targetCr?: number;
  boss_encounter: Encounter | null;
  treasure: string | null;
  feature: string | null;
}

export interface Dungeon {
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
}

export default class Dungeoneer {
  static defaultTeam(): Team {
    return {
      name: "Party",
      combatants: [{
        forename: "Hero",
        name: "Hero",
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
      healingPotions: 3
    };
  }

  static dungeonIcons = { temple: "🏛️", fortress: "🏯", library: "📚", tomb: "⚰️", mine: "⛏️", cave: "🕳️", crypt: "⚰️", tower: "🗼", }

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
            { forename: "Goblin", name: "Goblin", hp: 7, maxHp: 7, level: 1, ac: 15, dex: 14, str: 8, con: 10, int: 10, wis: 8, cha: 8, damageDie: 6, playerControlled: false, xp: 50, gp: 10, attackRolls: 1, weapon: "Dagger" }
          ]
        }
      }
    });
  }

  note(message: string): void { this.outputSink(message); }

  protected emit(event: DungeonEvent): void {
    this.journal.push(event);
    this.note(Events.present(event));
  }

  get icon() {
    return Dungeoneer.dungeonIcons[this.dungeon!.dungeon_type as keyof typeof Dungeoneer.dungeonIcons] || "🏰";
  }

  async setUp() {
    this.dungeon = await this.dungeonGen();
    // console.log("Dungeon details: " + JSON.stringify(this.dungeon, null, 2));
    console.log("Set up dungeon with CR " + this.dungeon.intendedCr);
  }

  // Main run loop
  async run(): Promise<void> {
    if (!this.dungeon) {
      await this.setUp();
    }

    // this.presentCharacterRecords();

    this.emit({
      type: "enterDungeon",
      dungeonName: this.dungeon!.dungeon_name,
      dungeonIcon: this.icon,
      dungeonType: this.dungeon!.dungeon_type,
      depth: this.dungeon!.depth
    });

    // assign dungeon environment to each combatants currentEnvironment
    this.playerTeam.combatants.forEach(c => c.currentEnvironment = this.dungeon!.terrain);

    while (!this.isOver()) {
      const room = this.currentRoom;
      if (!room) break;
      await this.enterRoom(room);
      if (this.currentEncounter && Combat.living(this.playerTeam.combatants).length > 0) {
        const survived = await this.runCombat();
        if (!survived) break;
      }

      this.emit({ type: "roomCleared" });
      let result = await this.roomActions(room);
      if (result.leaving) {
        this.note(`\nYou decide to leave the dungeon.`);
        return;
      }
      this.moveToNextRoom();
    }

    // Display outcome
    if (this.winner === 'Player') {
      this.note("\n🎉 Victory! Dungeon cleared!\n");
    } else {
      this.note("\n💀 Party defeated...\n");
    }
  }

  async skillCheck(type: SkillType, action: string, skill: keyof Combatant, dc: number): Promise<{
    actor: Combatant;
    success: boolean;
  }> {
    const actor = await this.select(`Who will attempt ${action}?`, this.playerTeam.combatants.map(c => ({
      name: `${c.name} ${Presenter.stat(skill, c[skill])} (${Presenter.statMod(c[skill])})`,
      value: c,
      short: c.name,
      disabled: c.hp <= 0
    })));

    let actorFx = Fighting.gatherEffects(actor);
    let skillBonusName = `${type}Bonus`;
    let skillBonus = actorFx[skillBonusName] as number || 0;
    let skillMod = Fighting.statMod(actor[skill] as number);

    this.note(`${actor.name} attempts ${action} with modifier ${skillMod} ` + (skillBonus > 0 ? ` and +${skillBonus} bonus.` : '.'));
    const roll = await this.roller(actor, action, 20);
    const total = roll.amount + skillMod + skillBonus;
    return { actor, success: total >= dc };
  }

  presentCharacterRecords(): void {
    console.log("Your party:");
    this.playerTeam.combatants.forEach(c => {
      console.log(Presenter.minimalCombatant(c));
      Presenter.printCharacterRecord(c);
    });
  }

  static dataPath = "./data"; // path.resolve(process.cwd() + "/data");

  // skipping for now -- running into cyclic structure issues :/
  private persistCharacterRecords(): void {
    for (const pc of this.playerTeam.combatants) {
      // write pc record to file (running into cyclic structure issues!!)
      let safePc = { ...pc, activeEffects: [], passiveEffects: [] }; // will need to recompute effects on load...
      Files.write(`${Dungeoneer.dataPath}/pcs/${pc.name}.json`, JSON.stringify(safePc, null, 2));
    }
  }

  describeRoom(room: Room | BossRoom, verb: string = "are standing in"): string {
    let description = `You ${verb} ${Words.a_an(room.room_size)} ${room.narrative}`;
    if (room.feature === "nothing") {
      description += ` This room would seem to contain little of interest to your party.`;
    } else {
      description += ` This room contains ${Stylist.bold(room.feature!)}.`;
    }
    return description;
  }

  async enterRoom(room: Room | BossRoom): Promise<void> {
    this.persistCharacterRecords();

    // if (this.isBossRoom) {
    //   this.note(`\n${"═".repeat(70)}`);
    //   this.note(`  💀 BOSS ROOM 💀`);
    //   this.note(`${"═".repeat(70)}`);
    // } else {
    //   const num = this.currentRoomIndex + 1;
    //   this.note(`\n${"─".repeat(70)}`);
    //   this.note(`ROOM ${num}/${this.rooms.length}`);
    //   this.note(`${"─".repeat(70)}`);
    // }

    let roomDescription = this.describeRoom(room, ["enter", "step into", "find yourself in"][Math.floor(Math.random() * 3)]);
    this.note(
      Stylist.italic(roomDescription)
    );

    // if (this.currentEncounter && Combat.living(this.currentEncounter.creatures).length > 0) {
    //   const monsters = this.currentEncounter.creatures.map(m => `\n - ${Presenter.combatant(m)}`).join(", ");
    //   this.note(`👹 Encounter: ${monsters} [CR: ${this.currentEncounter.cr}]\n`);
    // }

    // display current party status
    // const partyStatus = this.playerTeam.combatants.map(c => Presenter.minimalCombatant(c)).join("\n");
    // this.note(`🧙‍ Party Status:\n${partyStatus}\n`);
  }

  private async runCombat(): Promise<boolean> {
    if (Combat.living(this.currentMonsterTeam.combatants).length === 0) {
      return true;
    }
    const combat = new Combat({
      roller: this.roller,
      select: this.select,
      note: this.outputSink
    });

    await combat.setUp([this.playerTeam, this.currentMonsterTeam]);
    while (!combat.isOver()) {
      await combat.round(
        async (combatant: Combatant) => {
          console.warn(`Combatant '${combatant.name}' has fled the combat.`);
          // find another room for them
          let newRoom = this.nextRoom;
          if (newRoom) {
            this.note(`\n${combatant.name} escapes to the next room (${newRoom.room_type}).`);
            combatant.activeEffects = [];
            if ((newRoom as Room).encounter) {
              console.log("New room creature count before escape:", (newRoom as Room).encounter?.creatures.length);
              (newRoom as Room).encounter?.creatures.push(combatant);
              console.log("New room creature count after escape:", (newRoom as Room).encounter?.creatures.length);
            } else if ((newRoom as BossRoom).boss_encounter) {
              console.log("New boss room creature count before escape:", (newRoom as BossRoom).boss_encounter?.creatures.length);
              (newRoom as BossRoom).boss_encounter?.creatures.push(combatant);
              console.log("New boss room creature count after escape:", (newRoom as BossRoom).boss_encounter?.creatures.length);
            }
          } else {
            this.note(`\n${combatant.name} escapes the dungeon entirely!`);
          }
        }
      );
    }

    console.log(`Combat complete. Winner: '${combat.winner}'`);

    Combat.statistics.victories += (combat.winner === this.playerTeam.name) ? 1 : 0;
    Combat.statistics.defeats += (combat.winner !== this.playerTeam.name) ? 1 : 0;

    // Award XP/gold
    if (combat.winner === this.playerTeam.name) {
      // const encounter = this.currentEncounter!;
      const enemies = combat.teams.find(t => t.name === "Enemies")?.combatants || [];

      let xp = 0;
      let gold = 0;

      if (enemies.length > 0) {
        this.note(`\n🎉 You defeated ${Words.humanizeList(enemies.map(e => e.name))}!`);

        let monsterCount = enemies.length;
        xp = enemies.reduce((sum, m) => sum + (m.xp || 0), 0)
          + (monsterCount * monsterCount * 10)
          + 25;

        // gold = (encounter.bonusGold || 0) +
        //   enemies.reduce((sum, m) => sum + (Deem.evaluate(String(m.gp) || "1+1d2")), 0);
        for (const m of enemies) {
          const monsterGold = (await Deem.evaluate(String(m.gp))) || 0;
          gold += monsterGold;
        }

        this.note(`\n✓ Victory! +${xp} XP, +${gold} GP\n`);
      }

      if (Math.random() < 0.5) {
        console.log('The monsters dropped a healing potion!');
        this.playerTeam.healingPotions += 1;
      }

      if (xp > 0 || gold > 0) {
        await this.reward(xp, gold);
      }
      return true;
    }

    return false;
  }

  private async reward(xp: number, gold: number): Promise<void> {
    for (const c of this.playerTeam.combatants) {
      let fx = Fighting.gatherEffects(c);
      let xpMultiplier = fx.xpMultiplier as number || 1;
      let gpMultiplier = fx.goldMultiplier as number || 1;

      c.xp = Math.round((c.xp || 0) + xp * xpMultiplier);
      c.gp = Math.round((c.gp || 0) + gold * gpMultiplier);

      if (xp > 0) {
        let events = await CharacterRecord.levelUp(c, this.playerTeam, this.roller, this.select);
        events.forEach(e => this.emit({ ...e, turn: -1 } as DungeonEvent));
      }
    }
  }

  // After clearing room
  private async roomActions(room: Room | BossRoom): Promise<{
    leaving: boolean
  }> {
    this.note(this.describeRoom(room));

    let searched = false, examinedFeature = false;
    let done = false;
    while (!done) {
      const options = [
        { name: "Move to next room", value: "move", short: 'Continue', disabled: false }, //room === this.dungeon!.bossRoom },
        // { name: "Rest (stabilize unconscious party members, 30% encounter)", value: "rest", short: 'Rest', disabled: false },
        { name: "Search the room", value: "search", short: 'Search', disabled: searched },
      ];
      if (room.feature && room.feature !== "nothing") {
        options.push({ name: `Examine ${Words.remove_article(room.feature!)}`, value: "examine", short: 'Examine', disabled: examinedFeature });
      }
      // options.push({ name: "Leave the dungeon", value: "leave", short: 'Leave', disabled: false });

      let choice = await this.select("What would you like to do?", options);
      if (choice === "search") {
        await this.search(room);
        searched = true;
      } else if (choice === "rest") {
        const survivedNap = await this.rest(room);
        if (!survivedNap) {
          console.warn("The party was ambushed during their rest and defeated...");
        }
        return { leaving: true }
      } else if (choice === "examine") {
        let check = await this.skillCheck("examine", `to examine ${room.feature}`, "int", 10);
        if (check.success) {
          let gp = await Deem.evaluate("1+1d20");
          this.note(`${check.actor.forename} found a hidden compartment in ${room.feature} containing ${gp} gold coins!`);
          await this.reward(0, gp);
        } else {
          this.note(`${check.actor.forename} inspected ${room.feature} thoroughly, but could find nothing out of the ordinary.`);
        }
        examinedFeature = true;
      } else if (choice === "leave") {
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
    return { leaving: false };
  }

  private async search(room: Room | BossRoom): Promise<void> {
    let { actor, success } = await this.skillCheck("search", `to search the ${room.room_type.replaceAll("_", " ")}`, "wis", 10);
    if (success) {
      this.note(`${actor.forename} finds a hidden stash!`);
      if (room.treasure) {
        const xpReward = 10 + Math.floor(Math.random() * 20);
        this.note(`💎 You find ${room.treasure} (+${xpReward} XP)`);
        if (room.treasure == "a healing potion") {
          this.playerTeam.healingPotions = (this.playerTeam.healingPotions || 0) + 1;
          this.note(`You add the healing potion to your bag. (Total owned: ${this.playerTeam.healingPotions})`);
        }
        await this.reward(xpReward, 0);
      } else {
        const stashGold = await Deem.evaluate("2+1d20");
        let share = Math.round(stashGold / this.playerTeam.combatants.length)
        this.note(`Found ${stashGold} gold!`);
        await this.reward(0, share);

        let lootBonus = 0;
        let fx = Fighting.gatherEffects(actor);
        lootBonus += fx.lootBonus as number || 0;
        const potions = lootBonus + await Deem.evaluate("1d2");
        if (potions > 0) {
          this.note(`You found ${potions} healing potion${potions > 1 ? 's' : ''}!`);
          this.playerTeam.healingPotions = (this.playerTeam.healingPotions || 0) + potions;
          this.note(`You add the healing potion${potions > 1 ? 's' : ''} to your bag. (Total owned: ${this.playerTeam.healingPotions})`);
        }
      }
    } else {
      this.note(`\n${actor.forename} fails to find anything.`);
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
      for (const c of this.playerTeam.combatants) {
        if (c.hp <= 0) {
          c.hp = 1;
          this.note(`Stabilized ${c.name} at 1 HP.`);
        } // Stabilize unconscious characters
      }

      // ask if they want to use consumables/healing spells?
      let someoneWounded = this.playerTeam.combatants.some(c => c.hp < c.maxHp);
      if ((this.playerTeam.healingPotions > 0) && someoneWounded) {
        let usePotions = await this.select("Use healing potions?", [
          { name: "Yes", value: "yes", short: 'Y', disabled: false },
          { name: "No", value: "no", short: 'N', disabled: false }
        ]);
        if (usePotions === "yes") {
          for (const c of this.playerTeam.combatants) {
            if (c.hp < c.maxHp && this.playerTeam.healingPotions > 0) {
              c.hp = Math.min(c.maxHp, c.hp + await Deem.evaluate("2d4+2"));
              this.playerTeam.healingPotions -= 1;
              this.note(`Used a healing potion on ${c.name} (HP is now ${c.hp}/${c.maxHp}).`);
            }
          }
        }
      }

      if (Math.random() < 0.3 && this.currentRoomIndex < this.rooms.length) {
        // let encounter = this.encounterGen...
        let room = this.currentRoom as Room;
        room.encounter = await this.encounterGen(room.targetCr || 1);
        this.note(`\n👹 Wandering monsters interrupt your rest: ${Words.humanizeList(room.encounter.creatures.map(m => m.name))} [CR ${room.encounter.cr
          }]`);
        return await this.runCombat();
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
              playerControlled: false, xp: 500, gp: 1000, weapon: "Bite", damageKind: "piercing", abilities: ["melee"], traits: []
            }
          ]
        },
        treasure: "A legendary sword and a chest of gold.",
        feature: "a magical portal"
      },
      rooms: [
        {
          narrative: "A dimly lit cave with dripping water.",
          room_type: 'cave',
          room_size: 'small',
          treasure: "A rusty sword and a bag of gold coins.",
          feature: "a hidden alcove",
          encounter: {
            cr: 1,
            creatures: [
              {
                forename: "Goblin", name: "Goblin", hp: 7, maxHp: 7, level: 1, ac: 15, dex: 14, str: 8, con: 10, int: 10, wis: 8, cha: 8, 
                attackDie: "1d20", hitDie: 6, hasMissileWeapon: false,
                playerControlled: false, xp: 50, gp: 10, weapon: "Dagger", damageKind: "slashing", abilities: ["melee"], traits: []
              }
            ]
          }
        },
        {
          narrative: "A grand hall with ancient tapestries.",
          room_type: 'hall',
          room_size: 'large',
          treasure: "A magical amulet and a potion of healing.",
          feature: "a crumbling statue",
          encounter: {
            cr: 2,
            creatures: [
              {
                forename: "Orc", name: "Orc", hp: 15, maxHp: 15, level: 2, ac: 13, dex: 12, str: 16, con: 14, int: 8, wis: 10, cha: 8,
                attackDie: "1d20", hitDie: 8, hasMissileWeapon: false,
                playerControlled: false, xp: 100, gp: 20, weapon: "Axe", damageKind: "slashing", abilities: ["melee"], traits: []
              },
            ]
          }
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
      healingPotions: 0
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
