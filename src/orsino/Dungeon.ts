import Combat, { Gauntlet, RollResult } from "./Combat";
import { Team } from "./types/Team";
import Presenter from "./tui/Presenter";
import { Combatant } from "./types/Combatant";
import { Select } from "./types/Select";
import Words from "./tui/Words";
import Stylist from "./tui/Style";
import Deem from "../deem";

interface Encounter {
  monsters: Combatant[];
  bonusGold?: number;
  cr?: number;
}

interface Room {
  room_type: string;
  narrative: string;
  size: 'small' | 'medium' | 'large';
  targetCr?: number;
  treasure: string | null;
  encounter: Encounter | null;
}

interface BossRoom {
  narrative: string;
  size: 'small' | 'medium' | 'large';
  targetCr?: number;
  boss_encounter: Encounter | null;
  treasure: string | null;
}

interface Dungeon {
  dungeon_type: string;
  race: string;
  theme: string;
  aspect: string;
  dungeon_name: string;
  depth: number;
  rooms: Room[];
  bossRoom: BossRoom;
}

export default class Dungeoneer {
  private roller: (subject: Combatant, description: string, sides: number, dice: number) => Promise<RollResult>;
  private select: Select<any>;
  private outputSink: (message: string) => void;
  private currentRoomIndex: number = 0;

  playerTeam: Team;
  dungeonGen: () => Dungeon;
  dungeon: Dungeon;

  constructor(options: Record<string, any> = {}) {
    this.roller = options.roller || this.autoroll;
    this.select = options.select || this.autoselect;
    this.outputSink = options.outputSink || console.log;
    this.dungeonGen = options.dungeonGen || Dungeoneer.defaultGen;
    this.playerTeam = options.playerTeam || Dungeoneer.defaultTeam();

    if (!this.dungeonGen) {
      throw new Error('dungeonGen is required');
    }

    this.dungeon = this.dungeonGen();
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
      combatants: encounter?.monsters || [],
      healingPotions: 0
    };
  }

  get isBossRoom(): boolean {
    return this.currentRoomIndex === this.rooms.length;
  }

  nextRoom(): Room | BossRoom | null {
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

  private autoroll = async (subject: Combatant, description: string, sides: number, dice: number) => {
    return Combat.rollDie(subject, description, sides, dice);
  }

  private autoselect = async (prompt: string, options: any[]) => {
    this.outputSink(prompt);
    options.forEach((option, index) => {
      this.outputSink(`${index + 1}. ${option.name}`);
    });
    return options[0].value;
  }

  static defaultTeam(): Team {
    return {
      name: "Party",
      combatants: [{
        forename: "Hero",
        name: "Hero",
        hp: 14, maxHp: 14, level: 1, ac: 10,
        dex: 11, str: 12, int: 10, wis: 10, cha: 10, con: 12,
        attackRolls: 1,
        weapon: "Short Sword",
        damageDie: 8, playerControlled: true, xp: 0, gp: 0
      }],
      healingPotions: 3
    };
  }

  static dungeonIcons = {
    temple: "🏛️",
    fortress: "🏯",
    library: "📚",
    tomb: "⚰️",
    mine: "⛏️",
    cave: "🕳️",
    crypt: "⚰️",
    tower: "🗼",
  }

  presentCharacterRecords(): void {
    console.log("Your party:");
    this.playerTeam.combatants.forEach(c => {
      console.log(Presenter.combatant(c, false));
      console.table(c);
    });
  }

  // Main run loop
  async run(): Promise<void> {

    this.presentCharacterRecords();

    // @ts-ignore
    let icon = (Dungeoneer.dungeonIcons[this.dungeon.dungeon_type]) || "🏰";
    this.outputSink(`\n${"=".repeat(70)}`);
    this.outputSink(`  ${icon} ${this.dungeon.dungeon_name.toUpperCase()}`);
    this.outputSink(`  ${this.dungeon.depth} room ${this.dungeon.dungeon_type}`);
    this.outputSink(`  PCs: ${this.playerTeam.combatants.map(c => Presenter.combatant(c, false)).join(", ")}`);
    this.outputSink(`${"=".repeat(70)}\n`);

    while (!this.isOver()) {
      const room = this.currentRoom;
      if (!room) break;

      // Display room
      await this.enterRoom(room);

      // Combat if needed
      if (this.currentEncounter && this.currentEncounter.monsters.length > 0) {
        const survived = await this.runCombat();
        if (!survived) break;
      }

      this.outputSink(`\n✅ Room cleared!`);

      // await this.postCombatActions(room);

      // Room actions (search, rest, etc)
      await this.roomActions(room);

      // Move to next room
      this.nextRoom();
    }

    // Display outcome
    if (this.winner === 'Player') {
      this.outputSink("\n🎉 Victory! Dungeon cleared!\n");
    } else {
      this.outputSink("\n💀 Party defeated...\n");
    }
  }

  private async enterRoom(room: Room | BossRoom): Promise<void> {
    if (this.isBossRoom) {
      this.outputSink(`\n${"═".repeat(70)}`);
      this.outputSink(`  💀 BOSS ROOM 💀`);
      this.outputSink(`${"═".repeat(70)}`);
    } else {
      const num = this.currentRoomIndex + 1;
      this.outputSink(`\n${"─".repeat(70)}`);
      this.outputSink(`📍 ROOM ${num}/${this.rooms.length}`);
      this.outputSink(`${"─".repeat(70)}`);
    }

    this.outputSink(room.narrative);
    this.outputSink("");

    // if (room.treasure) {
    //   this.outputSink(`💎 Treasure: ${room.treasure}\n`);
    // }

    if (this.currentEncounter && this.currentEncounter.monsters.length > 0) {
      const monsters = this.currentEncounter.monsters.map(m => Presenter.combatant(m, false)).join(", ");
      this.outputSink(`👹 Encounter: ${monsters} [CR: ${this.currentEncounter.cr}]\n`);
    }

    // display current party status
    const partyStatus = this.playerTeam.combatants.map(c => Presenter.combatant(c, true)).join("\n");
    this.outputSink(`🧙‍ Party Status:\n${partyStatus}\n`);
  }

  private async runCombat(): Promise<boolean> {
    const combat = new Combat({
      roller: this.roller,
      select: this.select,
      outputSink: this.outputSink
    });

    // await combat.singleCombat([this.playerTeam, this.currentMonsterTeam]);
    await combat.setUp([this.playerTeam, this.currentMonsterTeam]);
    while (!combat.isOver()) {
      await combat.nextTurn();
    }

    // Award XP/gold
    if (combat.winner === this.playerTeam.name) {
      const encounter = this.currentEncounter!;
      const enemies = encounter.monsters.map(m => Stylist.format(m.name, 'bold'));
      this.outputSink(`\n🎉 You defeated ${Words.humanizeList(enemies)}!`);

      let monsterCount = encounter.monsters.length;
      const xp = encounter.monsters.reduce((sum, m) => sum + (m.xp || 0), 0)
        + (monsterCount * monsterCount * 10)
        + 25;
      const gold = (encounter.bonusGold || 0) + encounter.monsters.reduce((sum, m) => sum + (Deem.evaluate(String(m.gp) || "1+1d2")), 0);

      this.outputSink(`\n✓ Victory! +${xp} XP, +${gold} GP\n`);

      if (Math.random() < 0.5) {
        console.log('The monsters dropped a healing potion!');
        this.playerTeam.healingPotions += 1;
        // this.playerTeam.combatants.forEach(c => {
        //   c.hp = Math.min(c.maxHp, c.hp + 10);
        //   console.log(`Healing ${c.name} for 10 HP (HP: ${c.hp}/${c.maxHp})`);
        // });
      }

      await this.reward(xp, gold);
      return true;
    }

    return false;
  }

  private async reward(xp: number, gold: number): Promise<void> {
    // this.outputSink(`\n💰 Distributing rewards...`);
    // this.playerTeam.combatants.forEach(async c => {
    for (const c of this.playerTeam.combatants) {
      c.xp = (c.xp || 0) + xp;
      c.gp = (c.gp || 0) + gold;
      let nextLevelXp = Gauntlet.xpForLevel(c.level + 1);

      if (c.xp < nextLevelXp) {
        this.outputSink(`${c.name} needs to gain ${nextLevelXp - c.xp} more experience for level ${c.level + 1} (currently at ${c.xp}/${nextLevelXp}).`);

      }
      while (c.xp >= nextLevelXp) {
        c.level++;
        nextLevelXp = Gauntlet.xpForLevel(c.level + 1);
        c.maxHp += 1 + Math.max(0, Math.floor(c.con / 2));
        c.hp = c.maxHp;
        this.outputSink(`${Presenter.combatant(c)} leveled up to level ${c.level}!`);
        const stat = await this.select(`Choose a stat to increase:`, [
          { disabled: false, name: `Strength (${c.str})`, value: 'str', short: 'STR' },
          { disabled: false, name: `Dexterity (${c.dex})`, value: 'dex', short: 'DEX' },
          { disabled: false, name: `Intelligence (${c.int})`, value: 'int', short: 'INT' },
          { disabled: false, name: `Wisdom (${c.wis})`, value: 'wis', short: 'WIS' },
          { disabled: false, name: `Charisma (${c.cha})`, value: 'cha', short: 'CHA' },
          { disabled: false, name: `Constitution (${c.con})`, value: 'con', short: 'CON' },
        ]);
        // @ts-ignore
        c[stat] += 1;
        this.outputSink(`${c.name}'s ${stat.toUpperCase()} increased to ${c[stat as keyof Combatant]}!`);
      }
    }
    // this.outputSink(`\n💰 Rewards distributed!`);
  }

  private async roomActions(room: Room | BossRoom): Promise<void> {
    // Placeholder for search/rest/etc
    // Can be expanded later
    // After clearing room:
    const choice = await this.select("Rest here? (restores 1+1d8 HP, 30% encounter)", [
      { disabled: false, short: 'Y', name: "Yes", value: "yes" },
      { disabled: false, short: 'N', name: "No",  value: "no" }
    ]);
    if (choice === "yes") {
      // Heal party, maybe trigger encounter
      this.outputSink(`\n💤 Resting...`);
      this.playerTeam.combatants.forEach(c => {
        const heal = Deem.evaluate("1+1d8");
        c.hp = Math.min(c.maxHp, c.hp + heal);
        this.outputSink(`Healed ${c.name} for ${heal} HP (HP: ${c.hp}/${c.maxHp})`);
      });

      if (Math.random() < 0.3 && this.currentRoomIndex < this.rooms.length) {
        this.outputSink(`\n👹 A wandering monster interrupts your rest!`);
        // let encounter = this.encounterGen...
        let room = this.currentRoom as Room;
        room.encounter = {
          monsters: [
            { forename: "Goblin", name: "Goblin", hp: 7, maxHp: 7, level: 1, ac: 15, dex: 14, str: 8, con: 10, int: 10, wis: 8, cha: 8, damageDie: 6, playerControlled: false, xp: 50, gp: 10, attackRolls: 1, weapon: "Dagger" }
          ]
        };
        await this.runCombat();
      }
    }
  }

  static defaultGen(): Dungeon {
    return {
      dungeon_name: 'The Cursed Caverns',
      depth: 2,
      dungeon_type: 'cave',
      race: 'dwarven',
      theme: 'underground',
      aspect: 'dark',
      bossRoom: {
        narrative: "A shadowy chamber with a towering figure.",
        size: 'large',
        targetCr: 5,
        boss_encounter: {
          monsters: [
            { forename: "Shadow Dragon", name: "Shadow Dragon", hp: 50, maxHp: 50, level: 5, ac: 18, dex: 14, str: 20, con: 16, int: 12, wis: 10, cha: 14, damageDie: 10, playerControlled: false, xp: 500, gp: 1000, attackRolls: 2, weapon: "Bite" }
          ]
        },
        treasure: "A legendary sword and a chest of gold."
      },
      rooms: [
        {
          narrative: "A dimly lit cave with dripping water.",
          room_type: 'cave',
          size: 'small',
          treasure: "A rusty sword and a bag of gold coins.",
          encounter: {
            monsters: [
              { forename: "Goblin", name: "Goblin", hp: 7, maxHp: 7, level: 1, ac: 15, dex: 14, str: 8, con: 10, int: 10, wis: 8, cha: 8, damageDie: 6, playerControlled: false, xp: 50, gp: 10, attackRolls: 1, weapon: "Dagger" }
            ]
          }
        },
        {
          narrative: "A grand hall with ancient tapestries.",
          room_type: 'hall',
          size: 'large',
          treasure: "A magical amulet and a potion of healing.",
          encounter: {
            monsters: [
              { forename: "Orc", name: "Orc", hp: 15, maxHp: 15, level: 2, ac: 13, dex: 12, str: 16, con: 14, int: 8, wis: 10, cha: 8, damageDie: 8, playerControlled: false, xp: 100, gp: 20, attackRolls: 1, weapon: "Axe" }
            ]
          }
        }
      ]
    }
  }
}
