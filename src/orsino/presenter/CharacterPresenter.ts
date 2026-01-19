import AbilityHandler from "../Ability";
import Combat from "../Combat";
import CharacterRecord from "../rules/CharacterRecord";
import { Fighting, StatLine } from "../rules/Fighting";
import StatusHandler from "../Status";
import TraitHandler from "../Trait";
import Presenter from "../tui/Presenter";
import Stylist from "../tui/Style";
import Words from "../tui/Words";
import { Combatant, EquipmentSlot } from "../types/Combatant";
import { CombatContext, pseudocontextFor } from "../types/CombatContext";
import { ItemInstance, materializeItem } from "../types/ItemInstance";
import AbilityPresenter from "./AbilityPresenter";
import CombatantPresenter from "./CombatantPresenter";
import StatusPresenter from "./StatusPresenter";

export default class CharacterPresenter extends Presenter {
  static async printCharacterRecord(combatant: Combatant, inventory: ItemInstance[], sink: (text: string) => void = console.warn) {
    sink("\n" + "=".repeat(40) + "\n");
    sink(await this.characterRecord(combatant, inventory));
    sink("\n" + "=".repeat(40) + "\n");
  }

  static async characterRecord(combatant: Combatant, inventory: ItemInstance[]): Promise<string> {
    await AbilityHandler.instance.loadAbilities();
    await TraitHandler.instance.loadTraits();
    await StatusHandler.instance.loadStatuses();

    let record = "";
    // record += (Stylist.bold("\n\nCharacter Record\n"));
    record += (Stylist.format(`${CombatantPresenter.combatant(combatant)}\t${(this.statLine(combatant))}\n`, 'underline'));

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
      record += `  ${Stylist.colorize(ability.name, 'magenta').padEnd(28)} ${ability.description + ' ' || ''}${AbilityPresenter.describeAbility(ability)}\n`;
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
            record += `  ${StatusPresenter.describeStatusWithName(status)}\n`;
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
        record += `  ${Stylist.colorize(status.name, 'cyan')} (${StatusPresenter.analyzeStatus(status)
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
        record += `  ${Stylist.colorize(status.name, 'cyan')} (${StatusPresenter.analyzeStatus(status)})\n`;
      });
    }

    if (combatant.equipment && Object.keys(combatant.equipment).length > 0) {
      record += Stylist.bold("\nEquipped Items: \n");
      for (const slot of Object.keys(combatant.equipment)) {
        const equipmentSlot: EquipmentSlot = slot as EquipmentSlot;
        const itemName = (combatant.equipment as Record<EquipmentSlot, string>)[equipmentSlot];
        const item = materializeItem(itemName, inventory);
        record += `  ${Stylist.colorize(Words.capitalize(equipmentSlot), 'yellow')}: ${Words.humanize(item.name)} (${StatusPresenter.describeModifications(item.effect || {}, item.name)})\n`;
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
      record += `- **${ability.name}**: ${ability.description + ' ' || ''}${AbilityPresenter.describeAbility(ability)}<br/>\n`;
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
            record += `${StatusPresenter.describeStatus(status)}<br/>`;
          });
          record += "\n";
          // note: should already be included above??
          trait.abilities?.forEach(abilityName => {
            const ability = abilityHandler.getAbility(abilityName);
            if (ability) {
              record += `- **${ability.name}**: ${ability.description + ' ' || ''}${AbilityPresenter.describeAbility(ability)}<br/>\n`;
            }
          });
        }
      }
    }

    return record;
  }

}