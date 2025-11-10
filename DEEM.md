# Deem Language Specification

**Deem** is a domain-specific expression language for procedural content generation in TTRPGs. It combines dice notation, arithmetic, string manipulation, conditionals, and random selection into a simple, readable syntax.

## Language Overview

Deem expressions are evaluated in a context (a record of variable bindings) and produce a value. The language is designed to be embedded in JSON templates where property values can be Deem expressions.

### Design Principles

1. **RPG-Native**: First-class support for dice notation
2. **Functional**: Expressions evaluate to values with no side effects
3. **Contextual**: Access to previously computed values via variables
4. **Composable**: Expressions can nest and reference each other
5. **Readable**: Syntax resembles natural RPG notation

## Syntax

### Literals

#### Numbers
```
42          // Integer
3.14        // Floating point
.5          // Fractional (0.5)
```

#### Strings
```
"Hello, world!"
"The warrior's name"
""          // Empty string
```

#### Booleans
```
true
false
```

#### Null
```
nihil       // Represents null/none/nothing
```

### Identifiers

Identifiers are names without quotes. They can contain letters, digits, underscores, and start with a letter or `#`.

```
warrior
class_type
fighter2
```

### Variables

Variables reference values from the evaluation context, prefixed with `#`:

```
#str        // Value of 'str' from context
#gender     // Value of 'gender' from context
#_internal  // Internal variables also work
```

**Context Binding**: When evaluating templates, the context contains:
1. Options passed to `gen()`
2. Previously evaluated properties (in order)

Example:
```typescript
{
  str: '=3d6',           // Evaluates first
  hp: '=10 + #str'       // Can reference str
}
```

### Dice Notation

Standard RPG dice notation for random number generation:

```
d6          // Roll one six-sided die (1-6)
3d6         // Roll three six-sided dice, sum them (3-18)
2d10        // Roll two ten-sided dice (2-20)
d20         // Roll one twenty-sided die (1-20)
```

Dice can be combined with arithmetic:
```
3d6 + 2     // Roll 3d6 and add 2
2d4 * 3     // Roll 2d4 and multiply by 3
10 + d6     // Add a d6 roll to 10
```

### Arithmetic Operators

Standard arithmetic with proper precedence:

#### Addition
```
5 + 3       // => 8
2 + 3 + 4   // => 9
```

String concatenation also uses `+`:
```
"Hello, " + "world!"    // => "Hello, world!"
"Str: " + 15            // => "Str: 15" (coercion)
```

#### Multiplication
```
5 * 3       // => 15
2 * 3 * 4   // => 24
```

#### Precedence
Follows standard mathematical precedence:
1. Parentheses `()`
2. Multiplication `*`
3. Addition `+`

```
2 + 3 * 4       // => 14 (not 20)
(2 + 3) * 4     // => 20
1 + 2d6 * 3     // => 1 + (roll * 3)
```

#### Unary Operators
```
+5          // Positive (identity)
-5          // Negative
-(3 + 2)    // => -5
```

### Comparison Operators

#### Less Than
```
5 < 10      // => true
10 < 5      // => false
#str < 15   // Compare variable to 15
```

#### Greater Than
```
10 > 5      // => true
5 > 10      // => false
#str > 15   // Variable comparison
```

**Note**: Equality operators (`==`, `!=`, `<=`, `>=`) are defined in the grammar but not yet implemented in the semantics.

### Functions

Functions are called with parentheses and comma-separated arguments:

```
functionName(arg1, arg2, arg3)
```

#### Built-in Functions

##### `rand()`
Returns a random floating-point number between 0 and 1.

```
rand()              // => 0.7342... (random each time)
rand() * 100        // Random 0-100
rand() < 0.5        // 50% chance true
```

##### `oneOf(...)`
Randomly selects one of its arguments.

```
oneOf(warrior, mage, rogue)
oneOf(1, 2, 3, 4, 5, 6)
oneOf("Alice", "Bob", "Charlie")
oneOf(true, false)
```

Arguments can be any expression:
```
oneOf(3d6, 4d4, 2d10)
oneOf("Str: " + #str, "Dex: " + #dex)
```

##### `if(condition, trueValue, falseValue)`
Conditional expression (ternary operator).

```
if(true, "yes", "no")               // => "yes"
if(false, "yes", "no")              // => "no"
if(#str > 15, "Strong", "Weak")     // Variable-based
if(rand() < 0.5, "heads", "tails")  // Random outcome
```

Nested conditions:
```
if(#str > 18, "Mighty",
  if(#str > 15, "Strong",
    if(#str > 12, "Average", "Weak")))
```

##### `lookup(tableName, groupName)`
Looks up a random value from a named table.

**Context**: This function is injected by Orsino and accesses the current setting's tables.

```
lookup(name, male)          // Random male name
lookup(name, #gender)       // Use variable for group
lookup(treasure, minor)     // Random minor treasure
lookup(surname, #occupation)
```

Tables must be defined in the current setting. See Table documentation for structure.

##### `gen(type, options)`
Recursively generates content of a given type.

**Context**: Injected by Orsino, accesses templates/tables from the current setting.

```
gen(encounter)                      // Generate an encounter
gen(treasure)                       // Generate treasure
gen(pc, { gender: male })           // Generate with options
gen(npc, { role: "shopkeeper" })
```

Options override template properties:
```typescript
// Template has: gender: '=oneOf(male, female)'
gen(pc, { gender: "male" })  // Forces male
```

Nested generation example:
```
room: {
  encounter: '=gen(encounter)',
  treasure: '=if(rand() < 0.3, gen(treasure), nihil)'
}
```

### Parentheses

Group expressions to control evaluation order:

```
(2 + 3) * 4         // => 20
2 + (3 * 4)         // => 14
```

```
if((#str > 15) and (#dex > 15), "Exceptional", "Normal")
```

## Grammar

The formal grammar in EBNF-like notation (as defined in `src/deem.ohm.txt`):

```
Exp         = CompExp

CompExp     = CompExp "<" AddExp
            | CompExp ">" AddExp
            | AddExp

AddExp      = AddExp "+" MulExp
            | AddExp "-" MulExp    // Not yet implemented
            | MulExp

MulExp      = MulExp "*" ExpExp
            | MulExp "/" ExpExp    // Not yet implemented
            | ExpExp

ExpExp      = PriExp "^" ExpExp    // Not yet implemented
            | PriExp

PriExp      = "(" Exp ")"
            | "+" PriExp
            | "-" PriExp
            | FunctionCall
            | strlit
            | nihil
            | bool
            | ident
            | dice
            | number

FunctionCall = ident "(" ArgList? ")"

ArgList      = Exp ("," Exp)*

dice        = number "d" number    // Multi-die (3d6)
            | "d" number           // Single die (d20)

ident       = (letter | "#") (letter | digit | "#" | "_")*

strlit      = "\"" char* "\""

bool        = "true" | "false"

nihil       = "nihil"

number      = digit* "." digit+    // Fractional
            | digit+               // Whole
```

### Operator Precedence

From highest to lowest:

1. **Primary**: Literals, variables, function calls, parentheses
2. **Unary**: `+`, `-` (prefix)
3. **Exponentiation**: `^` (right-associative, not implemented)
4. **Multiplication**: `*`, `/` (left-associative, `/` not implemented)
5. **Addition**: `+`, `-` (left-associative, `-` not implemented)
6. **Comparison**: `<`, `>` (left-associative)

## Type System

Deem is dynamically typed. Values have types at runtime:

### Types

- **Number**: `42`, `3.14`, dice rolls
- **String**: `"text"`
- **Boolean**: `true`, `false`
- **Null**: `nihil`
- **Identifier**: Bare words like `warrior` (used as symbols)
- **Object**: Returned from `gen()` calls

### Type Coercion

#### String Concatenation
When using `+` with strings, other types are coerced:

```
"Str: " + 15        // => "Str: 15"
"Result: " + true   // => "Result: true"
"Value: " + nihil   // => "Value: null"
```

#### Comparison
Comparisons work on numbers:

```
5 < 10              // => true
```

Comparing incompatible types is undefined behavior.

## Evaluation Semantics

### Context

Every expression is evaluated with a context (an object mapping names to values):

```typescript
context = {
  str: 16,
  gender: "male",
  _firstName: "Aldric"
}
```

Variables reference context values:
```
#str        // => 16
#gender     // => "male"
```

Undefined variables throw errors:
```
#undefined  // Error: Undefined variable: undefined
```

### Evaluation Order

Templates evaluate properties in definition order, building the context incrementally:

```typescript
{
  str: '=3d6',              // Evaluated first, context: {}
  dex: '=3d6',              // context: { str: 12 }
  hp: '=10 + #str + #dex'   // context: { str: 12, dex: 14 }
}
// Result: { str: 12, dex: 14, hp: 36 }
```

### Randomness

Dice rolls and `rand()` produce different values each evaluation. Functions like `oneOf()` select randomly each time.

**No Caching**: Each expression evaluation is independent:

```
// In a template:
{
  roll1: '=3d6',    // => 10
  roll2: '=3d6'     // => 15 (different roll)
}
```

To reuse a value, store it in a variable:
```
{
  _roll: '=3d6',
  doubled: '=#_roll * 2',   // Uses same roll
  display: '="Roll: " + #_roll'
}
```

## Usage in Templates

Deem expressions are embedded in templates as string values prefixed with `=`:

### Template Example

```typescript
{
  // Static value (no evaluation)
  role: "hero",

  // Deem expression (evaluated)
  gender: "=oneOf(male, female)",

  // Reference variable
  name: "=lookup(name, #gender)",

  // Arithmetic with variables
  str: "=3d6",
  hp: "=10 + #str",

  // Conditional
  title: "=if(#str > 15, \"Strong\", \"Nimble\")",

  // Nested generation
  equipment: "=gen(treasure)"
}
```

### JSON Settings Example

```json
{
  "pc": {
    "gender": "=oneOf(male, female)",
    "name": "=lookup(name, #gender)",
    "class": "=oneOf(fighter, wizard, rogue)",
    "str": "=3d6",
    "hp": "=10 + #str"
  }
}
```

## Error Handling

### Parse Errors

Invalid syntax throws a parse error with position:

```
Deem.evaluate("3d6 +")
// Error: Failed to parse expression: 3d6 +
// Expected...
```

### Runtime Errors

#### Undefined Variables
```
if(#nonexistent > 5, "yes", "no")
// Error: Undefined variable: nonexistent
```

#### Unknown Functions
```
unknownFunc(1, 2, 3)
// Error: Unknown function: unknownFunc
```

#### Invalid Arguments
Type errors depend on function behavior. Most runtime errors propagate as JavaScript exceptions.

## Examples

### Character Generation

```typescript
{
  gender: "=oneOf(male, female, neutral)",
  name: "=lookup(name, #gender)",
  str: "=3d6 + 2",
  dex: "=3d6",
  con: "=3d6",
  hp: "=10 + #con",
  title: "=if(#str > 15, \"the Strong\", \"the Swift\")"
}
```

### Conditional Treasure

```typescript
{
  hasKey: "=rand() < 0.3",
  treasure: "=if(#hasKey, \"a golden key\", \"nothing\")"
}
```

### Complex Nested Generation

```typescript
{
  description: "=oneOf(\"dark cavern\", \"ancient hall\")",
  hasEncounter: "=rand() < 0.4",
  encounter: "=if(#hasEncounter, gen(encounter), nihil)",
  hasTreasure: "=rand() < 0.5",
  treasure: "=if(#hasTreasure, gen(treasure, { tier: minor }), nihil)"
}
```

### Name Composition

```typescript
{
  _firstName: "=lookup(name, #gender)",
  _lastName: "=lookup(surname, #occupation)",
  name: "=#_firstName + \" \" + #_lastName"
}
```

### Tier-Based Values

```typescript
{
  tier: "=oneOf(1, 2, 3, 4, 5)",
  damage: "=#tier + \"d6\"",          // "3d6"
  value: "=#tier * 100"               // 300
}
```

## Implementation Notes

### Parser

Deem uses [Ohm.js](https://ohmjs.org/), a parsing toolkit with:
- Declarative grammar in `src/deem.ohm.txt`
- Semantic actions in `src/deem.ts`
- Separate `eval` and `pretty` operations

### Standard Library

The standard library is a simple object in `src/deem.ts`:

```typescript
Deem.stdlib = {
  rand: () => Math.random(),
  if: (cond, t, f) => cond ? t : f,
  oneOf: (...args) => args[Math.floor(Math.random() * args.length)]
};
```

Additional functions (`lookup`, `gen`) are injected by Orsino at generation time.

### Extension

To add a new function:

1. Add to `Deem.stdlib`:
```typescript
Deem.stdlib.myFunc = (arg1, arg2) => {
  return arg1 + arg2;
};
```

2. Use in templates:
```
"=myFunc(10, 20)"
```

## Limitations

### Not Yet Implemented

These are defined in the grammar but not in the semantic actions:

- Subtraction operator `-`
- Division operator `/`
- Exponentiation operator `^`
- Equality `==`, `!=`
- Less/greater or equal `<=`, `>=`

### No Statements

Deem has expressions only, no statements. Everything evaluates to a value.

### No Loops

No iteration constructs. Use the CLI `--count` option or `genList()` for repetition.

### No Variable Assignment

Variables come from context only. You cannot reassign or create new bindings within an expression.

### Limited String Operations

Only concatenation with `+`. No substring, replace, or other string methods.

## Future Enhancements

Possible future additions:

- **List literals**: `[1, 2, 3]`
- **List operations**: `first()`, `rest()`, `length()`
- **String functions**: `upper()`, `lower()`, `substring()`
- **Math functions**: `min()`, `max()`, `floor()`, `ceil()`
- **Remaining operators**: `-`, `/`, `^`, `==`, `!=`, `<=`, `>=`
- **Let bindings**: Local variable definition
- **Weighted random**: `weightedOneOf([70, warrior], [20, mage], [10, rogue])`
- **Ranges**: `range(1, 10)` for numeric ranges
- **Boolean operators**: `and`, `or`, `not`

## Reference Summary

### Operators (Implemented)

| Operator | Meaning | Example | Result |
|----------|---------|---------|--------|
| `+` | Addition/Concatenation | `5 + 3` | `8` |
| `+` | String concatenation | `"Hi " + "there"` | `"Hi there"` |
| `*` | Multiplication | `5 * 3` | `15` |
| `<` | Less than | `5 < 10` | `true` |
| `>` | Greater than | `10 > 5` | `true` |
| `-` | Negation (unary) | `-5` | `-5` |
| `+` | Positive (unary) | `+5` | `5` |

### Functions

| Function | Arguments | Description | Example |
|----------|-----------|-------------|---------|
| `rand()` | None | Random 0-1 | `rand()` |
| `oneOf(...)` | 1+ expressions | Random choice | `oneOf(a, b, c)` |
| `if(c, t, f)` | 3 expressions | Conditional | `if(#str > 15, "yes", "no")` |
| `lookup(t, g)` | table, group | Table lookup | `lookup(name, male)` |
| `gen(type, opts)` | type, options | Generate content | `gen(encounter)` |

### Literals

| Type | Examples |
|------|----------|
| Number | `42`, `3.14`, `.5` |
| String | `"Hello"`, `"world"` |
| Boolean | `true`, `false` |
| Null | `nihil` |
| Identifier | `warrior`, `male`, `Fighter` |

### Dice

| Notation | Description | Range |
|----------|-------------|-------|
| `d6` | One six-sided die | 1-6 |
| `3d6` | Three six-sided dice | 3-18 |
| `d20` | One twenty-sided die | 1-20 |
| `2d10 + 5` | Two d10s plus 5 | 7-25 |

### Variables

| Syntax | Meaning |
|--------|---------|
| `#varName` | Reference context variable |
| `#str` | Value of `str` property |
| `#_internal` | Internal variable |

---

**Version**: 0.1.0
**Last Updated**: 2025-11-10
**Grammar**: `src/deem.ohm.txt`
**Implementation**: `src/deem.ts`
