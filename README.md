# Orsino

Old-School TTRPG engine

# Features

- OSR-style rules engine and template/table-based generation
- `orsino gen ...` (Generate entities based on templates and tables)
- `orsino play ...` (Play through geneated worlds -- for now just `combat` gauntlets and `dungeon`)

# Deem, Templates and Tables
## Tables

Tables are lists organized by a 'discriminator' or category.

```
"hitPoints": {
    "discriminator": "class",
    "groups": {
      "warrior": 10,
      "mage": 6,
      "thief": 8,
      "cleric": 8,
      "bard": 6,
      "ranger": 8
    }
  }
```

Use Deem's builtin `lookup` to extract values (ie `lookup(hitPoints, "thief")` would retrieve the value 8.)

If the value is an array, lookup will sample randomly, so that you can also use this to create bias tables.

## Templates

Templates are plain JSON objects whose values can have _Deem_ expressions. Any key whose value is prefixed by `=` will be evaluated during generation. Consider this template that shows off a lot of the capabilities:

```json
"monster": {
    "_terrain": "=oneOf(forest, cave, swamp, mountain, snow, desert)",
    "race": "=oneOf(goblin, kobold, orc, human, ogre, troll, dragon)",
    "type": "=lookup(monsterType, #race)",
    "forename": "=lookup(monsterName, #race)",
    "_class": "=capitalize(#_terrain) + \" \" + capitalize(#race) + \" \" + #type",
    "name": "=#forename + \", \" + #_class",
    "_baseHp": "=lookup(monsterBaseHp, #race)",
    "_hpVariance": "=lookup(monsterHpVariance, #race)",
    "maxHp": "=#_baseHp + round(rand()*#_hpVariance)",
    "level": "=lookup(monsterLevel, #race)",
    "str": "=lookup(monsterStr, #race)",
    "dex": "=lookup(monsterDex, #race)",
    "con": "=lookup(monsterCon, #race)",
    "int": "=lookup(monsterInt, #race)",
    "wis": "=lookup(monsterWis, #race)",
    "cha": "=lookup(monsterCha, #race)",
    "_naturalArmor": "=lookup(monsterNaturalArmor, #race)",
    "ac": "=10 + #_naturalArmor + floor((#dex-10)/2)",
    "attacks": "=lookup(monsterAttacks, #race)",
    "weapon": "=lookup(monsterWeapon, #race)",
    "damageDie": "=lookup(attackDice, #weapon)",
    "_damageBonus": "=floor((#str-10)/2)",
    "xp": "=lookup(monsterXp, #race)",
    "gp": "=lookup(monsterGold, #race)",

    "*terrainModifier": "=lookup(monsterTerrainModifier, #_terrain)",
    "hp": "=#maxHp"
  }
```

Deem will work through the structure key by key and evaluate the value expressions in order, allowing you to
construct complex assembly mechanisms. Here's some example output for this template:

```
┌───────────┬──────────────────────────────┐
│           │ Values                       │
├───────────┼──────────────────────────────┤
│      race │ orc                          │
│      type │ Berserker                    │
│  forename │ Norgorak                     │
│      name │ Norgorak, Snow Orc Berserker │
│     maxHp │ 10                           │
│     level │ 2                            │
│       str │ 16                           │
│       dex │ 11                           │
│       con │ 17                           │
│       int │ 8                            │
│       wis │ 8                            │
│       cha │ 8                            │
│        ac │ 13                           │
│   attacks │ 1                            │
│    weapon │ mace                         │
│ damageDie │ 6                            │
│        xp │ 50                           │
│        gp │ 2d10                         │
│        hp │ 10                           │
└───────────┴──────────────────────────────┘
```

## Deem Evaluation

All expressions starting with `=` will get evaluated by Deem. 
Assembled values flow hierarchically down and are available in sub-generations (ie if you call `gen(entity)` or `genList(entity, count)` as part of an expression.)

The engine supports the following features:

- Arithmetic (eg `1+2`, `2*3^4`, `5/10`)
- Dice notation (eg `1d3`, `2d10`)
- Comparisons (`==`, `!=`, `>`, `<`, `>=`, `<=`)
- Boolean logic (`||`, `&&`, unary not `!`)
- Use `#variableName` to reference any other field already assembled in the template (`"name": "=#forename + \", \" + #type"`)

Note there are special key structures that give additional hints to assembly:
- Keys with `_` are omitted from final output structure so can be useful for intermediate values
- Keys prefixed with `*` merge their result into the parent object. That is, if the result of evaluating a star-prefixed key is itself an object, all values are 'overlaid' onto matching already-assembled values (any values from the overlay object will be added to the assembled value matching that key). For instance, with the terrain modification above:

```json
"*terrainModifier": "=lookup(terrainMods, #terrain)"
```

If `terrainMods` returns `{con: -1, dex: 1}`, those values are added to the monster's base stats, creating variants like "Swamp Goblin" with adjusted attributes.


## Deem Builtins

- `oneOf(item1, item2...)`: select randomly from a list
- `lookup(tableName, value)`: select randomly from a table, indexed by value
- `if(condition, true_value, false_value)`: apply a logical condition
- `gen()`: call generate again and create a subentity
- `genList(entity, count)`.  Note `genList` can be used in combination with `sum(list, condition)` which is a specialized helper to help with constrained/budget-based list generation. Note condition _must_ be a string for this to work since we need to re-evaluate it to check we haven't fulfilled the condition yet! Within `condition` you can reference `__items` (the list as it is being constructed). `genList` will also inject `_index` to generated items.

There are some simple math and lexical operations as well:
- `round(number)` rounds to the nearest whole number
- `ceil(number)` and `floor(number)` round up and down to the nearest whole number respectively
- `capitalize(string)` returns the given string value with the first character capitalized

# TODO

- Dungeone- Dungeoneering: explore the generated dungeons
- World mode: explore the hinterlands and return to cities to spend gold
- Textual gloss? Illustrations?
- Generator trace/debug mode: Add a `--trace` flag to the CLI that logs the evaluation stack of a template. This should include the key being processed, the expression being evaluated, and the result. This will provide a clear, step-by-step visualization of the generation process for debugging complex templates.