import Stylist from "./Style";
import { Combatant, EquipmentSlot } from "../types/Combatant";
import Words from "./Words";
import { Fighting, StatLine } from "../rules/Fighting";
import AbilityHandler, { Ability, AbilityEffect, TargetKind } from "../Ability";
import TraitHandler from "../Trait";
import Combat from "../Combat";
import { CombatContext, pseudocontextFor } from "../types/CombatContext";
import StatusHandler, { StatusEffect, StatusModifications } from "../Status";
import { never } from "../util/never";
import { ItemInstance, materializeItem } from "../types/ItemInstance";
import CharacterRecord from "../rules/CharacterRecord";

export default class Presenter {
  static colors = ['magenta', 'red', 'yellow', 'yellow', 'yellow', 'green', 'green', 'green', 'green'];

  static aggregateList = (items: string[]) => {
    const counts: { [item: string]: number } = {};
    items.forEach(item => {
      counts[item] = (counts[item] || 0) + 1;
    });
    return Object.entries(counts).map(([item, count]) => {
      return count > 1 ? `${item} x${count}` : item;
    }).join(", ");
  }

  static markdownCharacterRecord(combatant: Combatant): string {
    let record = "";
    record += (`### ${combatant.name}\n`);
    record += `_${combatant.description || CharacterRecord.describe(combatant)}_\n`;

    const statNames = ['str', 'dex', 'int', 'wis', 'cha', 'con'];
    const effective = Fighting.effectiveStats(combatant);
    // we want a table like | str | dex | int | wis | cha | con |
    record += "\n|   |   |   |   |   |   |";
    record += "\n|---|---|---|---|---|---|\n";
    statNames.forEach(stat => {
      record += (`| ${stat.toUpperCase()} `);
    });
    record += "|\n";
    statNames.forEach(stat => {
      const value = (effective)[stat as keyof StatLine];
      // const mod = Fighting.statMod(value);
      // const sign = mod >= 0 ? '+' : '';
      record += (`| ${value}`); // (${sign}${mod}) `);
    })
    record += "|\n";

    record += `\n\n**Hit Points:** ${combatant.hp}/${effective.maxHp}\n\n`;
    const basics = {
      weapon: (combatant.equipment?.weapon || 'None'),
      armor: combatant.equipment?.body || 'None',
      xp: combatant.xp,
      gp: combatant.gp,
    }
    for (const [key, value] of Object.entries(basics)) {
      record += (`**${Words.capitalize(key)}:** ${Words.humanize(value.toString())}<br/>\n`);
    }

    const pseudocontext: CombatContext = pseudocontextFor(combatant, []);
    const effectiveWeapon = Fighting.effectiveWeapon(combatant, pseudocontext);
    const effectiveArmorClass = Fighting.effectiveArmorClass(combatant, pseudocontext);

    const core = {
      "Attack Die": effectiveWeapon.damage,
      "Armor Class": effectiveArmorClass,
      "Spell Slots": ["mage", "bard", "cleric"].includes(combatant.class || '') ? Combat.maxSpellSlotsForCombatant(combatant) : "none"
    }
    for (const [key, value] of Object.entries(core)) {
      record += (`**${Words.capitalize(key)}:** ${Words.humanize(value.toString())}\n`);
    }

    // spells + skills
    record += ("\n\n_Abilities_<br/>\n");
    const abilityHandler = AbilityHandler.instance;
    for (const abilityName of combatant.abilities || []) {
      const ability = abilityHandler.getAbility(abilityName);
      record += `- **${ability.name}**: ${ability.description + ' ' || ''}${this.describeAbility(ability)}<br/>\n`;
    }

    // traits
    const passiveEffectsFromTraits: string[] = [];
    if (combatant.traits && combatant.traits.length > 0) {
      const traitHandler = TraitHandler.instance;
      record += ("\n_Traits_<br/>\n\n");
      for (const traitName of combatant.traits || []) {
        const trait = traitHandler.getTrait(traitName);
        if (trait) {
          record += `**${(trait.description)}**<br/>\n`;
          trait.statuses?.forEach(status => {
            passiveEffectsFromTraits.push(status.name);
            record += `- **${status.name}** (${status.description})<br/>`;
            record += `${this.describeStatus(status)}<br/>`;
          });
          record += "\n";
          // note: should already be included above??
          trait.abilities?.forEach(abilityName => {
            const ability = abilityHandler.getAbility(abilityName);
            if (ability) {
              record += `- **${ability.name}**: ${ability.description + ' ' || ''}${this.describeAbility(ability)}<br/>\n`;
            }
          });
        }
      }
    }

    return record;
  }


  static async printCharacterRecord(combatant: Combatant, inventory: ItemInstance[], sink: (text: string) => void = console.log) {
    sink("\n" + "=".repeat(40) + "\n");
    sink(await this.characterRecord(combatant, inventory));
    sink("\n" + "=".repeat(40) + "\n");
  }

  // static describeCharacter(combatant: Combatant) {
  //   const descriptor = {
  //     male: "He is", female: "She is", androgynous: "They are"
  //   }[(combatant.gender || 'androgynous').toLowerCase()] || "They are";

  //   const what = `${Words.humanize(combatant.archetype || 'neutral')} ${(Words.humanize(combatant.background || 'adventurer'))}`;

  //   return `${Words.capitalize(combatant.referenceName || combatant.forename)} is ${Words.a_an(what)} from the ${combatant.hometown || 'unknown'}, ${combatant.age || 'unknown'} years old. ${descriptor} of ${combatant.body_type || 'average'} build with ${combatant.hair || 'unknown color'} hair, ${combatant.eye_color || 'dark'} eyes and ${Words.a_an(combatant.personality || 'unreadable')} disposition.`
  // }

  static async characterRecord(combatant: Combatant, inventory: ItemInstance[]): Promise<string> {
    await AbilityHandler.instance.loadAbilities();
    await TraitHandler.instance.loadTraits();
    await StatusHandler.instance.loadStatuses();

    let record = "";
    // record += (Stylist.bold("\n\nCharacter Record\n"));
    record += (Stylist.format(`${this.combatant(combatant)}\t${(this.statLine(combatant))}\n`, 'underline'));

    // "Human Female Warrior of Hometown (41 years old)"

    record += (
      Stylist.italic(
        CharacterRecord.describe(combatant)
      ) + "\n\n"
    )
    const statNames = ['str', 'dex', 'int', 'wis', 'cha', 'con'];
    const effective = Fighting.effectiveStats(combatant);
    const statLine = statNames.map(stat => {
      const value = (effective)[stat as keyof StatLine];
      const mod = Fighting.statMod(value);
      const color = mod > 0 ? 'green' : (mod < 0 ? 'red' : 'white');
      const sign = mod >= 0 ? '+' : '';
      return `${Stylist.bold(stat.toUpperCase())} ${value} (${Stylist.colorize(sign + mod, color)})`;
    });
    record += statLine.join(' | ');

    record += "\nHit Points: " + Stylist.colorize(`${combatant.hp}/${effective.maxHp} \n`, 'green');
    const weapon = combatant.equipment?.weapon ? materializeItem(combatant.equipment?.weapon, inventory) : { name: 'Unarmed' };
    const armor = combatant.equipment?.body ? materializeItem(combatant.equipment?.body, inventory) : { name: 'None' };

    const basics = {
      weapon: weapon.name, //`${weapon.name} (slot value: ${combatant.equipment?.weapon})`,
      armor: armor.name,
      xp: combatant.xp,
      gp: combatant.gp,
    }
    record += ("\n" + Object.entries(basics).map(([key, value]) => {
      return this.padLiteralEnd(`${Stylist.bold(Words.capitalize(key))} ${value.toString()}`, 25);
    }).join('   ')) + "\n";

    const pseudocontext: CombatContext = pseudocontextFor(combatant, inventory);
    //{ subject: combatant, inventory: inventory, allies: [combatant], enemies: [], enemyInventory: [], allyIds: new Set([combatant.id]), enemyIds: new Set() };
    const effectiveWeapon = Fighting.effectiveWeapon(combatant, pseudocontext);
    const effectiveArmorClass = Fighting.effectiveArmorClass(combatant, pseudocontext);
    const bolt = Stylist.colorize('⚡', 'yellow');
    const core = {
      "Attack Die": Stylist.colorize(effectiveWeapon.damage, 'red'),
      "Armor Class": Stylist.colorize(`${effectiveArmorClass}`, 'yellow'),
      "Spell Slots": ["mage", "bard", "cleric"].includes(combatant.class || '') ?
        bolt.repeat(Combat.maxSpellSlotsForCombatant(combatant)) : "none"
    }
    record += (Object.entries(core).map(([key, value]) => {
      return this.padLiteralEnd(`${Stylist.bold(Words.capitalize(key))} ${Words.humanize(value)}`, 25);
    }).join('   ')) + "\n";

    // ability table
    record += Stylist.bold("\nAbilities\n");
    const abilityHandler = AbilityHandler.instance;
    for (const abilityName of combatant.abilities || []) {
      const ability = abilityHandler.getAbility(abilityName);
      record += `  ${Stylist.colorize(ability.name, 'magenta').padEnd(28)} ${ability.description + ' ' || ''}${this.describeAbility(ability)}\n`;
    }

    // traits
    const passiveEffectsFromTraits: string[] = [];
    if (combatant.traits && combatant.traits.length > 0) {
      const traitHandler = TraitHandler.instance;
      record += Stylist.bold("\nTraits\n");
      for (const traitName of combatant.traits || []) {
        const trait = traitHandler.getTrait(traitName);
        if (trait) {
          record += `  ${Stylist.colorize(trait.description, 'blue')}\n`;
          trait.statuses?.forEach(status => {
            passiveEffectsFromTraits.push(status.name);
            // record += `  ${Stylist.colorize(status.name, 'cyan')} (${status.description})\n`;
            record += `  ${this.describeStatusWithName(status)}\n`;
          });

          if ((trait.abilities || []).length > 0) {
            record += Stylist.italic("  Grants abilities: " + trait.abilities?.map(a => Stylist.colorize(a, 'magenta')).join(', '));
          }
          record += "\n";
        }
      }
    }

    // active and passive effects
    if (combatant.activeEffects && combatant.activeEffects.length > 0) {
      record += Stylist.bold("\nActive Effects\n");
      combatant.activeEffects.forEach(status => {
        record += `  ${Stylist.colorize(status.name, 'cyan')} (${this.analyzeStatus(status)
          })\n`;
      });
    }
    const otherPassives = combatant.passiveEffects?.filter(effect => !passiveEffectsFromTraits.includes(effect.name)) || [];
    if (otherPassives.length > 0) {
      record += Stylist.bold("\nPassive Effects\n");
      otherPassives.forEach(status => {
        if (passiveEffectsFromTraits.includes(status.name)) {
          return; // already listed above
        }
        record += `  ${Stylist.colorize(status.name, 'cyan')} (${this.analyzeStatus(status)})\n`;
      });
    }

    if (combatant.equipment && Object.keys(combatant.equipment).length > 0) {
      record += Stylist.bold("\nEquipped Items: \n");
      for (const slot of Object.keys(combatant.equipment)) {
        const equipmentSlot: EquipmentSlot = slot as EquipmentSlot;
        const itemName = (combatant.equipment as Record<EquipmentSlot, string>)[equipmentSlot];
        const item = materializeItem(itemName, inventory);
        record += `  ${Stylist.colorize(Words.capitalize(equipmentSlot), 'yellow')}: ${Words.humanize(item.name)} (${this.describeModifications(item.effect || {}, item.name)})\n`;
      }
    }

    if (inventory && inventory.length > 0) {
      const presentItem = (it: ItemInstance) => {
        return `${it.name}${it.charges !== undefined ? ` (${it.charges}/${it.maxCharges} charges)` : ''}`;
      }
      record += Stylist.bold("\nGear: ") +
        this.aggregateList(inventory.sort((a, b) => a.name.localeCompare(b.name))
          .map(presentItem)) + "\n";
    }


    return record;
  }

  static minimalCombatant = (combatant: Combatant) => {
    const effective = Fighting.effectiveStats(combatant);
    const hpRatio = combatant.hp / effective.maxHp;
    const hpBar = Stylist.prettyValue(combatant.hp, effective.maxHp);
    const color = this.colors[Math.floor(hpRatio * (this.colors.length - 1))] || this.colors[0];
    let name = Stylist.format(combatant.forename, 'bold');

    let combatClass = combatant.class;


    const fx = Fighting.effectList(combatant);
    if (fx.some(e => e.effect?.displayName)) {
      const firstNameOverride = fx.find(e => e.effect?.displayName)?.effect?.displayName;
      if (firstNameOverride) {
        name = Stylist.format(firstNameOverride, 'bold');
      }
    }
    if (fx.some(e => e.effect?.displayClass)) {
      const firstClassOverride = fx.find(e => e.effect?.displayClass)?.effect?.displayClass;
      if (firstClassOverride) {
        combatClass = firstClassOverride;
      }
    }

    const combatKind = (combatant as unknown as { kind?: string }).kind || Words.humanize(combatant.race || '');
    const combatantType = combatClass ? `${Words.capitalize(combatKind ? (combatKind + ' ') : '')}${Words.capitalize(combatClass)}` : '';

    let tempHp = 0;
    for (const poolAmount of Object.values(combatant.tempHpPools || {})) {
      tempHp += poolAmount;
    }
    return [
      Stylist.colorize(name, combatant.playerControlled ? 'cyan' : 'yellow'),
      combatant.hp <= 0 ? Stylist.colorize('X', 'red') : Stylist.colorize(hpBar, color),
      tempHp > 0 ? Stylist.colorize(`(+${tempHp})`, 'blue') : '',
      combatant.hp > 0 ? `${combatant.hp}/${effective.maxHp}` : 'KO',
      combatantType
      // combatClass ? `${Words.capitalize(combatKind ? (combatKind + ' ') : '')}${Words.capitalize(combatClass)}` : '',
    ].join(' ');
  }

  static combatant = (combatant: Combatant) => {

    const effective = Fighting.effectiveStats(combatant);
    const fx = Fighting.effectList(combatant);
    // gather displa class
    let displayClass = combatant.class;
    if (fx.some(e => e.effect?.displayClass)) {
      const firstClassOverride = fx.find(e => e.effect?.displayClass)?.effect?.displayClass;
      if (firstClassOverride) {
        displayClass = firstClassOverride;
      }
    }

    const hpRatio = combatant.hp / effective.maxHp;
    const hpBar = Stylist.prettyValue(combatant.hp, effective.maxHp);
    const color = this.colors[Math.floor(hpRatio * (this.colors.length - 1))] || this.colors[0];

    const combatClass = displayClass || combatant.class;
    const combatKind = (combatant).kind || Words.humanize(combatant.race || '');
    let classInfo = combatClass ? `Lvl. ${combatant.level.toString().padEnd(2)} ${Words.capitalize(combatKind ? (combatKind + ' ') : '')}${Words.capitalize(combatClass)}` : '';
    // const effective = Fighting.effectiveStats(combatant);
    // const stats = { STR: effective.str, DEX: effective.dex, INT: effective.int, WIS: effective.wis, CHA: effective.cha, CON: effective.con };
    // const statInfo = Object.entries(stats).map(([key, value]) => `${key}: ${value}`).join(', ');
    //Presenter.statLine(combatant);

    const fxNameAndDurations = combatant.activeEffects?.map(e => ({ name: e.name, duration: e.duration || '--' })) || [];
    if (fxNameAndDurations.length > 0) {
      classInfo = classInfo.padEnd(32) + ' | ' + Words.humanizeList(fxNameAndDurations.map(fx => {
        return fx.name;  //  turns`${fx.name} (${fx.duration})`;
      }));
    }

    const friendly = combatant.playerControlled;
    let name = combatant.name;
    // const fx = Fighting.effectList(combatant);
    if (fx.some(e => e.effect?.displayName)) {
      const firstNameOverride = fx.find(e => e.effect?.displayName)?.effect?.displayName;
      if (firstNameOverride) {
        name = Stylist.format(firstNameOverride, 'bold');
      }
    }
    const lhs = `${Stylist.colorize(hpBar, color)} ${Stylist.format(
      Stylist.colorize(name, friendly ? 'cyan' : 'yellow'),
      'bold'
    ).padEnd(40)}${classInfo}`;
    // let rhs = `(${this.statLine(combatant)})`;
    // return `${lhs} ${rhs}`;
    return lhs;
  }

  static statLine(combatant: Combatant) {
    const effective = Fighting.effectiveStats(combatant);
    return [
      this.stat('str', effective.str),
      this.stat('dex', effective.dex),
      this.stat('int', effective.int),
      this.stat('wis', effective.wis),
      this.stat('cha', effective.cha),
      this.stat('con', effective.con)
    ].join('');
  }

  static statColors: { [key in keyof Combatant]?: string } = {
    str: 'red',
    dex: 'yellow',
    int: 'green',
    wis: 'blue',
    cha: 'magenta',
    con: 'cyan',
  }

  static stat = (stat: keyof Combatant, value: number) => {
    const color = this.statColors[stat] || 'white';
    return Stylist.colorize(Stylist.prettyValue(value, 20), color);
  }

  static statMod = (value: number) => {
    const mod = Fighting.statMod(value);
    const color = mod > 0 ? 'green' : (mod < 0 ? 'red' : 'white');
    const sign = mod >= 0 ? '+' : '';
    return Stylist.colorize(sign + mod, color);
  }

  static combatants = (combatants: Combatant[], minimal: boolean = false, indicate: (combatant: Combatant) => boolean) => {
    return combatants
      .filter(c => c.hp > 0)
      .map(c => ((minimal ? "" : "\n") + (indicate(c) ? " 👉 " : "  ") + (minimal ? this.minimalCombatant(c) : this.combatant(c))))
      .join(minimal ? ", " : "");
    // return combatants.map(c => this.combatant(c)).join('\n');
  }

  static padLiteralEnd = (text: string, length: number, padChar: string = ' ') => {
    const cleanLength = Stylist.cleanLength(text);
    if (cleanLength >= length) { return text; }
    const padLength = length - cleanLength;
    return text + padChar.repeat(padLength);
  }

  static padLiteralStart = (text: string, length: number, padChar: string = ' ') => {
    const cleanLength = Stylist.cleanLength(text);
    if (cleanLength >= length) { return text; }
    const padLength = length - cleanLength;
    return padChar.repeat(padLength) + text;
  }

  static presentableEffects = (combatant: Combatant) => {
  }

  static parties = (parties: { name: string; combatants: Combatant[] }[]) => {
    let partyDisplay = "";
    const lines = Math.max(...parties.map(p => p.combatants.length))
    // sort combatants alphabetically within each party
    parties.forEach(party => {
      party.combatants.sort((a, b) => a.name.localeCompare(b.forename));
    });
    for (let i = 0; i < lines; i++) {
      // names
      const lhs = parties[0] ? parties[0].combatants[i] : null;
      const rhs = parties[1] ? parties[1].combatants[i] : null;
      let line = "";
      if (lhs) {
        line += this.padLiteralEnd(this.minimalCombatant(lhs), 40);
      } else {
        line += ' '.repeat(40);
      }
      // line += '';
      if (rhs) {
        line += this.padLiteralStart(this.minimalCombatant(rhs), 40);
      } else {
        line += ' '.repeat(40);
      }
      partyDisplay += line + '\n';

      // traits / statuses
      const ignoreStatuses = ['humanoid']
      let lhsStatuses = [
        ...(lhs?.activeEffects || []),
        // ...(lhs?.passiveEffects?.filter(e => (e.equipment)) || [])
      ].map(e => e.duration ? `${e.name}(${e.duration})` : e.name)
        || [];
      // console.log("Rendering statuses for line", i, lhsStatuses);
      lhsStatuses = lhsStatuses
        .map(s => s.toLowerCase())
        .filter(s => !ignoreStatuses.includes(s.toLowerCase()));
      let rhsStatuses = rhs?.activeEffects?.map(e => e.duration ? `${e.name}(${e.duration})` : e.name)
        .concat(rhs?.traits || []) || [];
      rhsStatuses = rhsStatuses
        .map(s => s.toLowerCase())
        .filter(s => !ignoreStatuses.includes(s));

      const sep = // dot
        '·';
      let statusLine = "";
      if (lhsStatuses.length > 0) {
        statusLine += this.padLiteralEnd(Stylist.colorize(lhsStatuses.join(sep), 'cyan'), 40);
      } else {
        statusLine += ' '.repeat(40);
      }
      if (rhsStatuses.length > 0) {
        statusLine += this.padLiteralStart(Stylist.colorize(rhsStatuses.join(sep), 'cyan'), 40);
      } else {
        statusLine += ' '.repeat(40);
      }
      partyDisplay += statusLine + '\n';
    }
    const headers = //parties.map(p => Stylist.format(p.name, 'underline').padEnd(40)).join('   ') + '\n';
      Stylist.format(parties[0].name.padEnd(40), 'italic') +
      Stylist.format(parties[1]?.name.padStart(40) || '', 'italic') + '\n';
    return headers + partyDisplay;
  }

  static describeStatusWithName(status: StatusEffect | string): string {
    const statusEffect = StatusHandler.instance.dereference(status);
    if (!statusEffect) {
      throw new Error(`Buff effect has unknown status: ${JSON.stringify(status)}`);
    }

    // let concreteStatus: StatusEffect;
    // if (typeof status === 'string') {
    //   const fetchedStatus = StatusHandler.instance.getStatus(status);
    //   if (!fetchedStatus) {
    //     throw new Error(`Status ${status} not found`);
    //   }
    //   concreteStatus = fetchedStatus;
    // } else {
    //   concreteStatus = status;
    // }
    return `${statusEffect.name} (${this.describeStatus(statusEffect)})`;
    // return this.analyzeStatus(status);
  }

  static describeStatus(status: StatusEffect | string): string {
    const statusEffect = StatusHandler.instance.dereference(status);
    if (!statusEffect) {
      throw new Error(`Buff effect has unknown status: ${JSON.stringify(status)}`);
    }


    //(status.description ? status.description + " " : '') +
    return Words.capitalize(this.analyzeStatus(statusEffect));
  }

  static analyzeStatus(status: StatusEffect): string {
    const parts: string[] = [];
    const effect = status.effect;

    if (status.whileEnvironment) {
      parts.push(`While in ${Words.a_an(status.whileEnvironment)} environment`);
    }
    if (status.condition) {
      if (status.condition.weapon) {
        if (status.condition.weapon.weight) {
          parts.push(`When wielding a ${Words.humanize(status.condition.weapon.weight)} weapon`);
        }
      }
    }
    parts.push(this.describeModifications(effect, status.name));

    if (status.duration !== undefined) {
      parts.push(this.describeDuration(status.duration));
    }
    return parts.join(' ');
  }

  static describeModifications(effect: StatusModifications, modName?: string): string {
    const parts: string[] = [];

    if (effect === undefined || Object.keys(effect).length === 0) {
      // throw new Error("Cannot describe empty effect modifications for mod " + (modName || 'unknown'))
      return "No enchantment";
    }

    // console.log("Describing modifications:", JSON.stringify(effect));
    // if all effect entries are saves or immunities, summarize differently
    const allSameValue = Object.values(effect).every(value => value === Object.values(effect)[0]);
    const allSavesOrImmunities = Object.keys(effect).every(key => {
      return key.startsWith("saveVersus") || key.startsWith("immune");
    });
    if (allSavesOrImmunities && allSameValue) {
      const saves: string[] = [];
      const immunities: string[] = [];
      for (const [key, value] of Object.entries(effect)) {
        if (value === undefined) { continue; }
        const k: keyof StatusModifications = key as keyof StatusModifications;
        if (key.startsWith("saveVersus") && (value as number) > 0) {
          saves.push(Words.humanize(k.replace("saveVersus", "")));
        } else if (key.startsWith("immune") && (value as boolean)) {
          immunities.push(Words.humanize(k.replace("immune", "")));
        }
      }
      if (saves.length > 0) {
        parts.push(`+${Object.values(effect)[0]} to saves versus ${saves.join(', ')}`);
      }
      if (immunities.length > 0) {
        parts.push(`Immunity to ${immunities.join(', ')}`);
      }
      return parts.join('; ');
    }

    const allStatMods = ['str', 'dex', 'con', 'int', 'wis', 'cha'].every(stat => {
      return effect[stat as keyof StatusModifications] !== undefined;
    })
    if (allStatMods && allSameValue) {
      parts.push(this.increaseDecrease('all stats', effect.str as number));
      return parts.join('; ');
    }


    for (const [key, value] of Object.entries(effect)) {
      if (value === undefined) { continue; }
      const k: keyof StatusModifications = key as keyof StatusModifications;
      switch (k) {
        case "allRolls":
          parts.push(this.increaseDecrease('all rolls', value as number));
          break;
        case "rerollNaturalOnes":
          if (value) {
            parts.push(`Reroll natural ones`);
          }
          break;
        case "str":
        case "dex":
        case "con":
        case "int":
        case "wis":
        case "cha":
          parts.push(this.increaseDecrease(Words.statName(k), value as number));
          break;
        case "initiative":
          parts.push(this.increaseDecrease('initiative', value as number));
          break;
        case "toHit":
          parts.push(this.increaseDecrease('to hit', value as number));
          break;
        case "bonusDamage":
          parts.push(this.increaseDecrease('bonus damage', value as number));
          break;
        case "bonusMeleeDamage":
          parts.push(this.increaseDecrease('bonus melee damage', value as number));
          break;
        case "bonusPoisonDamage":
          parts.push(this.increaseDecrease('bonus poison damage', value as number));
          break;
        case "criticalRangeIncrease":
          parts.push(this.increaseDecrease('critical range', value as number));
          break;
        case "ac":
          parts.push(this.increaseDecrease('AC', -value));
          break;
        case "evasion":
          parts.push(this.increaseDecrease('evasion', value as number));
          break;
        case "bonusHealing":
          parts.push(this.increaseDecrease('bonus healing', value as number));
          break;
        // case "allSaves":
        //   parts.push(this.increaseDecrease('all saves', value));
        //   break;
        case "resistBleed":
        case "resistPoison":
        case "resistPsychic":
        case "resistLightning":
        case "resistFire":
        case "resistCold":
        case "resistBludgeoning":
        case "resistPiercing":
        case "resistSlashing":
        case "resistForce":
        case "resistRadiant":
        case "resistNecrotic":
        case "resistAcid":
        case "resistSonic":
        case "resistTrue":
        case "resistAll":
          if (value as number > 0) {
            parts.push(`${Math.round((value as number) * 100)}% resistance to ${Words.humanize(k.replace("resist", ""))}`);
          } else {
            parts.push(`${Math.round(Math.abs((value as number)) * 100)}% vulnerability to ${Words.humanize(k.replace("resist", ""))}`);
          }
          break;
        case "saveVersusPoison":
        case "saveVersusDisease":
        case "saveVersusDeath":
        case "saveVersusMagic":
        case "saveVersusInsanity":
        case "saveVersusCharm":
        case "saveVersusFear":
        case "saveVersusStun":
        case "saveVersusWill":
        case "saveVersusBreath":
        case "saveVersusParalyze":
        case "saveVersusSleep":
        case "saveVersusBleed":
        case "saveVersusReflex":
        case "saveVersusFortitude":
          parts.push(this.increaseDecrease(`Save versus ${Words.humanize(k.replace("saveVersus", ""))}`, value as number));
          break;
        case "saveVersusAll":
          parts.push(this.increaseDecrease('all saves', value as number));
          break;

        case "immunePoison":
        case "immuneDisease":
        case "immuneDeath":
        case "immuneMagic":
        case "immuneInsanity":
        case "immuneCharm":
        case "immuneFear":
        case "immuneStun":
        case "immuneWill":
        case "immuneBreath":
        case "immuneParalyze":
        case "immuneSleep":
        case "immuneBleed":
        case "immuneReflex":
        case "immuneFortitude":
          if (value) {
            parts.push(`Immunity to ${Words.humanize(k.replace("immune", ""))}`);
          }
          break;

        case "noActions":
          if (value) {
            parts.push(`Cannot take actions`);
          }
          break;
        case "randomActions":
          if (value) {
            parts.push(`Actions are random`);
          }
          break;
        case "noSpellcasting":
          if (value) {
            parts.push(`Cannot cast spells`);
          }
          break;
        case "noStatusExpiry":
          if (value) {
            parts.push(`Status effects do not expire`);
          }
          break;
        case "flee":
          if (value) {
            parts.push(`Fleeing`);
          }
          break;

        case "onCombatStart":
        case "onAttack":
        case "onAttackHit":
        case "onTurnEnd":
        case "onKill":
        case "onAttacked":
        case "onExpire":
        case "onHeal":
        case "onLevelUp":
        case "onOffensiveCasting":

        // @eslint-disable-next-line no-fallthrough
        case "onEnemyCharge":
        case "onEnemyMelee":
        case "onEnemyAttack":
        case "onEnemyDamage":
        case "onEnemyHeal":
        case "onEnemyBuff":
        case "onEnemyDebuff":
        case "onEnemySummon":
        case "onEnemyCasting":
        case "onEnemyOffensiveCasting":

        // @eslint-disable-next-line no-fallthrough
        case "onMissReceived":
        case "onSaveVersusPoison":
        case "onSaveVersusDisease":
        case "onSaveVersusDeath":
        case "onSaveVersusMagic":
        case "onSaveVersusInsanity":
        case "onSaveVersusCharm":
        case "onSaveVersusFear":
        case "onSaveVersusStun":
        case "onSaveVersusWill":
        case "onSaveVersusBreath":
        case "onSaveVersusParalyze":
        case "onSaveVersusBleed":
        case "onSaveVersusSleep":
        case "onSaveVersusReflex":
        case "onSaveVersusFortitude":
          parts.push(`${Words.capitalize(Words.humanize(k).toLocaleLowerCase())}, ${this.describeEffects(value as AbilityEffect[], 'self')}`);
          break;

        case "summonAnimalBonus":
          parts.push(this.increaseDecrease('summon animal bonus', value as number));
          break;
        case "bonusSpellSlots":
          parts.push(this.increaseDecrease('bonus spell slots', value as number));
          break;
        case "bonusSpellDC":
          parts.push(this.increaseDecrease('bonus spell DC', value as number));
          break;
        case "spellDurationBonus":
          parts.push(this.increaseDecrease('status duration', value as number));
          break;
        case "spellDurationMultiplier":
          parts.push(this.multipliedBy('status duration', value as number));
          break;
        case "backstabMultiplier":
          // parts.push(`Backstab damage multiplied by ${value}x`);

          parts.push(this.multipliedBy('backstab damage', value as number));
          break;
        case "resurrectable":
          if (value) {
            parts.push(`Resurrectable`);
          } else {
            parts.push(`Not resurrectable`);
          }
          break;

        case "extraAttacksPerTurn":
          parts.push(this.increaseDecrease('attacks per turn', value as number));
          break;

        // noncombat
        case "examineBonus":
          parts.push(this.increaseDecrease('examine bonus', value as number));
          break;
        case "searchBonus":
          parts.push(this.increaseDecrease('search bonus', value as number));
          break;
        case "pickLockBonus":
          parts.push(this.increaseDecrease('pick lock bonus', value as number));
          break;
        case "disarmTrapBonus":
          parts.push(this.increaseDecrease('disarm trap bonus', value as number));
          break;
        case "lootBonus":
          parts.push(this.increaseDecrease('loot bonus', value as number));
          break;

        case "xpMultiplier":
          parts.push(this.multipliedBy('XP gain', value as number));
          break;
        case "goldMultiplier":
          parts.push(this.multipliedBy('Gold earned', value as number));
          break;
        case "consumableMultiplier":
          // parts.push(`Consumables effectiveness multiplied by ${value}x`);
          parts.push(this.multipliedBy('consumable effectiveness', value as number));
          break;
        case "changeAllegiance":
          if (value) {
            parts.push(`Allegiance changed`);
          }
          break;

        case "compelNextMove":
          if (value) {
            parts.push(`Next move compelled to be ${value}`);
          }
          break;

        case "forceTarget":
          if (value) {
            parts.push(`Next target forced to be ${value}`);
          }
          break;

        case "tempHp":
          parts.push(`Gain ${value} temporary HP`);
          break;

        // case "maxHp":
        //   parts.push(this.increaseDecrease('max HP', value));
        //   break;

        case "damageReduction":
          parts.push(`Reduce all damage by ${value}`);
          break;

        case "reflectDamagePercent":
          parts.push(this.increaseDecrease('damage reflection percent', value * 100 + '%'));
          break;

        case "reflectSpellChance":
          parts.push(this.increaseDecrease('spell reflection chance', value * 100 + '%'));
          break;

        case "untargetable":
          if (value) {
            parts.push(`Untargetable`);
          }
          break;

        case "invisible":
          if (value) {
            parts.push(`Invisible`);
          }
          break;

        case "seeInvisible":
          if (value) {
            parts.push(`Can perceive invisible entities`);
          }
          break;

        case "extraTurns":
          parts.push(this.increaseDecrease('extra turns', value as number));
          break;

        case "triggerReactions":
          if (!value) {
            parts.push(`Does not trigger reactions`);
          }
          break;

        case "displayName":
          if (value) {
            parts.push(`Displayed name changed to "${value}"`);
          }
          break;

        case "displayClass":
          if (value) {
            parts.push(`Displayed class changed to "${value}"`);
          }
          break;

        case "effectiveStats":
          if (value) {
            const stats = value as Partial<Combatant>;
            for (const [statKey, statValue] of Object.entries(stats)) {
              parts.push(`${statKey.toUpperCase()} set to ${statValue as number}`);
            }
          }
          break;

        case "effectiveWeapon":
          if (value) {
            parts.push(`Weapon set to ${value}`);
          }
          break;

        case "effectiveArmor":
          if (value) {
            parts.push(`Armor set to ${value}`);
          }
          break;

        case "effectiveSize":
          if (value) {
            parts.push(`Size set to ${Words.humanize(value as string)}`);
          }
          break;

        case "effectiveAbilities":
          if (value) {
            const abilities = value as string[];
            parts.push(`Abilities set to: ${abilities.map(a => Words.humanize(a)).join(', ')}`);
          }
          break;


        // case "maxHp":
        //   parts.push("max HP set to " + value);
        //   break;

        case "attackDie":
          parts.push("attack die set to " + value);
          break;

        case "controlledActions":
          if (value) {
            parts.push(`Actions are controlled`);
          }
          break;

        case "mayUseItems":
          if (value) {
            parts.push(`May use items`);
          } else {
            parts.push(`May not use items`);
          }
          break;

        case "mayBeHealed":
          if (value) {
            parts.push(`May be healed`);
          } else {
            parts.push(`May not be healed`);
          }
          break;

        case "hasPrimaryAttack":
          if (value) {
            parts.push(`Has primary attack`);
          } else {
            parts.push(`No primary attack`);
          }
          break;

        case "readThoughts":
          if (value) {
            parts.push(`Can read surface thoughts of others`);
          }
          break;

        default:
          if ((k as string).startsWith("onEnemy")) {
            parts.push(`${this.describeEffects(value as AbilityEffect[], 'self')} ${Words.humanize(k)}`);
            break;
          } else if ((k as string).endsWith("Multiplier")) {
            // get just first part
            const what = (k as string).replace("Multiplier", "");
            parts.push(this.multipliedBy(Words.humanize(what), value as number));
            break;
          }

          return never(k);
      }
    }
    return parts.join(", ");
  }

  static increaseDecrease(what: string, value: number | string): string {
    if (typeof value === 'string') {
      return `add ${value} to ${what}`;
    }
    return value >= 0
      ? `improve ${what} by ${value}`
      : `degrade ${what} by ${Math.abs(value)}`;
  }

  static multipliedBy(what: string, value: number): string {
    const percentage = typeof value === 'number' ? Math.round((value - 1) * 100) : null;
    return value >= 1 ? `+${percentage}% ${what}` : `-${Math.abs(percentage || 0)}% ${what}`;
  }

  static describeDuration(duration?: number): string {
    if (duration) {
      return duration > 1 ? `for ${duration} turns` : `for ${duration} turn`;
    }
    return "indefinitely";
  }

  static describeSummoning(effect: AbilityEffect): string {
    let options = "";
    if ((effect.options)?._class) {
      options += ` of class ${Words.capitalize((effect.options)._class)} `;
    } else if ((effect.options)?.level) {
      options += ` level ${(effect.options).level} `;
    } else if ((effect.options)?.monster_type) {
      options += ` with type ${(effect.options).monster_type} `;
    } else if ((effect.options)?.rank) {
      options += ` at rank ${(effect.options).rank} `;
    }
    return options;
  }

  static describeEffect(effect: AbilityEffect, targetDescription: string): string {
    let description = "";
    let amount = effect.amount ? effect.amount.toString() : "1";
    if (amount.startsWith('=')) {
      amount = amount.slice(1);
    }

    switch (effect.type) {
      case "attack":
        description = (`Attack ${targetDescription}`);
        break;
      case "damage":
        description = (`Deal ${amount} ${effect.kind || "true"} damage to ${targetDescription}`);
        break;
      case "cast":
        if (!effect.spellName) {
          throw new Error(`Cast effect must have a spellName`);
        }
        description = (`Cast ability ${Words.humanize(effect.spellName)} (${this.describeAbility(AbilityHandler.instance.getAbility(effect.spellName))
          }) on ${targetDescription}`);
        break;
      case "heal": description = (`Heal ${targetDescription} ${amount} HP`); break;
      case "drain": description = (`Drain ${targetDescription} ${amount} HP`); break;
      case "buff":
        if (effect.status) {
          description = (`Grant ${targetDescription} ${this.describeStatusWithName(effect.status)}`);
        } else {
          console.warn(`Buff effect missing status: ${JSON.stringify(effect)}`);
          throw new Error(`Buff effect must have a status defined`);
        }
        break;
      case "debuff":
        if (effect.status) {
          const verb = targetDescription.startsWith("all") || targetDescription.includes("enemies")
            ? "suffer"
            : "suffers";
          description = (`${Words.capitalize(targetDescription)} ${verb} ${this.describeStatusWithName(effect.status)}`); // ${this.describeDuration(effect.status.duration)}`);
        } else {
          throw new Error(`Debuff effect ${JSON.stringify(effect)} must have a status defined`);
        }
        break;
      case "summon":
        description = (`Summon ${this.describeSummoning(effect)}${effect.creature || "creature"}`); break;
      case "removeStatus":
        description = (`Purge ${targetDescription} of ${effect.statusName}`); break;
      case "upgrade":
        if (effect.stat) {
          description = (`Permanently increase ${targetDescription} ${Words.statName(effect.stat)} by ${effect.amount || "1"}`);
        } else {
          throw new Error(`Upgrade effect must specify a stat`);
        }
        break;
      case "flee":
        description = (`Force ${targetDescription} to flee`); break;
      case "resurrect":
        const hp = effect.hpPercent && effect.hpPercent < 100 ? `${effect.hpPercent}%` : "full";
        description = (`Restore ${targetDescription} to life${effect.hpPercent ? ` with ${hp} health` : ""}`); break;
      case "kill":
        description = (`Instantly kill ${targetDescription}`); break;
      case "gold":
        description = (`Gain ${amount} gold`); break;
      case "xp":
        description = (`Gain ${amount} XP`); break;
      case "randomEffect":
        description = (`Apply one of the following random effects to ${targetDescription}: ${(effect.randomEffects || []).map((opt: AbilityEffect) => this.describeEffect(opt, targetDescription)).join('; ')
          }`); break;
      case "cycleEffects":
        description = (`Cycle through the following effects on ${targetDescription}: ${(effect.cycledEffects || []).map((opt: AbilityEffect) => this.describeEffect(opt, opt.target || targetDescription)).join('; ')
          }`); break;
      case "learn":
        description = (`Learn ability ${Words.humanize(effect.abilityName!)} (${this.describeAbility(AbilityHandler.instance.getAbility(effect.abilityName!))
          })`); break;
      case "grantPassive":
        // lookup status by name
        if (!effect.traitName) {
          throw new Error(`grantPassive effect must have a traitName`);
        }
        const trait = TraitHandler.instance.getTrait(effect.traitName);
        const statuses = trait?.statuses && trait.statuses.length > 0 ?
          trait.statuses.map(s => this.describeStatusWithName(s)).join(' and ')
          : '';
        const abilities = trait?.abilities && trait.abilities.length > 0 ?
          trait.abilities.map(a => this.describeAbility(
            AbilityHandler.instance.getAbility(a)
          )).join(' and ')
          : '';
        const conferParts = [];
        if (statuses) { conferParts.push(`statuses: ${statuses}`); }
        if (abilities) { conferParts.push(`abilities: ${abilities}`); }
        description = (`Grant passive trait ${effect.traitName} conferring ${conferParts.join(' and ')} to ${targetDescription}`); break;
      case "teleport":
        description = (`Teleport ${targetDescription} to ${effect.location} `); break;
      case "planeshift":
        description = (`Planeshift ${targetDescription} to ${effect.location}`); break;
      case "recalculateHp":
        description = (`Recalculate HP for ${targetDescription}`); break;
      case "acquireItem":
        description = (`Acquire item ${effect.itemName} for ${targetDescription}`); break;
      default:
        console.warn(`Unknown effect type: ${effect.type} for effect ${JSON.stringify(effect)}`);
        return never(effect.type);
    }

    if (effect.spillover) {
      description += ` with spillover to adjacent targets`;
    }

    const cascade = effect.cascade ? ` cascading ${effect.cascade.count} times` : "";
    description += cascade;


    let condition = '';
    if (effect.condition) {
      condition += effect.condition.trait ? ` if ${effect.condition.trait}` : "";
      // condition += effect.condition.status ? ` if ${effect.condition.status}` : "";
    }
    description += condition;

    return description
      // strip extra spaces
      .replace(/\s+/g, ' ');
  }

  static describeEffects(effects: AbilityEffect[], targetDescription: string = ""): string {
    const parts: string[] = [];
    if (effects.every(e => e.type === 'removeStatus') && effects.length > 0) {
      const statuses = effects.map(e => e.statusName).join(', ');
      return `Remove ${statuses} from ${targetDescription}`;
    }
    for (const effect of effects) {
      parts.push(this.describeEffect(effect, effect.target || targetDescription || "[missing target]"));
    }
    return Words.capitalize(parts.join("; "));
  }

  static describeTarget(target: TargetKind[]): string {
    const parts: string[] = [];
    for (const t of target) {
      let desc = "";
      switch (t) {
        case "self": desc = "yourself"; break;
        case "ally": desc = "an ally"; break;
        case "enemy": desc = "an enemy"; break;
        case "allies": desc = "all allies"; break;
        case "party": desc = "your party"; break;
        case "enemies": desc = "all enemies"; break;
        case "all": desc = "all combatants"; break;
        case "deadAlly": desc = "a fallen ally"; break;
        case "randomEnemies": return `${target[1]} random enemies`;
        default: return never(t);
      }
      parts.push(desc);
    }
    return parts.join(" or ");
  }

  static describeAbility(ability: Ability): string {
    if (ability.effects.length === 0) {
      return "Does nothing.";
    }
    // let parts: string[] = [];
    // parts.push("Narrative: " + ability.description);
    // parts.push("Mechanical: " + this.describeEffects(ability.effects, this.describeTarget(ability.target)) + ".");
    // return parts.join("\n");
    // console.log("Describing ability:", ability.name, ability);
    return this.describeEffects(ability.effects, this.describeTarget(ability.target)) + ".";
  }
}