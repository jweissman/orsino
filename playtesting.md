# Notes from Playtesting

[ ] Loot should be accumulated ("X takes it" = added to a list on their pc record)
[ ] Maybe you can leave an offering (5gp) at a (dungeon) shrine for a blessing?
---
[ ] Load all PCs on party select so we can show their race/class (no longer even letting you load PCs from file but we're still persisting them every room...)
---
[ ] A room generated with multiple monsters with the same name (humans may need more names as a race but also maybe we could _specifically_ try to prevent this?) [genList would need a dedupe pass to really be _certain_ of this]
[ ] CR scaling still not working great for deeper rooms? (seems to be vaguely more reasonable now but also we've kind of nerfed CR checks by _only_ checking NPCs when there are also true monsters and animal companions now -- we can constrain-gen them independently but seems subtle too somehow)
[ ] 20 should be stat max until level 10 (maybe 18 until level 5...)
[ ] High-level enemies should have much higher dex (tried to adjust although maybe _too_ high now?)
---
[ ] Rest could reset status effects? (would be nice to do this _before_ persisting PCs?)
[ ] A spell that causes stun could be interesting (flesh-to-stone would be neat too?)
[ ] Healing potion could cure poison status too?
[ ] Poisoned blade still has weird expiration message actually? ("X is no longer poisoned blade"; a bit awkward to fix since a standard message would be ideal here)
[ ] Might be good/wise/prudent to gather status effects into constants so we're not subject to (as many) typo bugs! (more generally it would be nice to have a statuses.json for defining common effects like poisoning uniformly...)
[ ] Target CR for the dungeon was 4 but first three rooms all had CR 3??
[ ] Unify search/examine (should both have chance to find potions and both grant XP on success)
[ ] Duplicate forenames still problematic -- maybe 'forename' can just _be_ magical within deem (genList could identify and toss dupes to prevent issues like this -- may cause other problems and seems weird... adding some gross genUniqListByKey seems 'too heavy' too; or we could have a 'gather' function that grabs all values of the __items but the expression then just gets too gnarly; note technically it's not even the 'name' key but 'forename' which ... we could just have a much deeper list to draw from to prevent this happening so often but that doesn't really solve this fundamentally!)
[ ] A cage could have a chance to have a prisoner (who could become ally); incidentally would be nice for it to be more likely within a 'cell' room
---
[ ] Enemy AC seems _really_ low -- a character with high dex is always getting 0 or less to hit! (maybe fixed by giving them armor?)
[ ] Larger rooms could give more search opps?
[ ] Adventuring kit could be a consumable that is needed to give first aid?
[ ] Found treasure should be redeemable for gold
---
[ ] Remind players to rest if they're not at full health going into boss battle
---
[ ] Healing for 0 HP should be presented as a failure (not "heals for 0 damage" but "tried to heal but fails")
[ ] Temple blessing should _recharge_ duration if already present (ie just having the blessing should not necessarily disable prayer)
[ ] Should be able to see what active effects you have even in town
[ ] Would be interesting to distinguish between positive/negative effects (maybe rest should cure only bad things?)
[ ] Healing should never present more HP than the character has lost (incidentally there should be a 'handleHeal' command so we're always processing it consistently)
[ ] AC still seems really low for monsters (maybe should go back to displaying it and thac0/to-hit bonuses just to sanity-check the math even if it's very noisy)
[ ] We don't seem to redisplay room details if you've levelled up?
[ ] Maybe taking damage makes enemies more likely to defend?
[ ] CR levels still seem _very_ high for bosses (but maybe more about how the CR scales in progression over the dungeon; that said we also add "+1" to the target + depth so maybe could remove that?)
[ ] Need money sinks + some other consumable besides potion (again maybe adventuring kits power first aid)
[ ] Examining maps/atlases could have a chance to give dungeon clues?
[ ] Maybe you need a clue to travel to a dungeon??
[ ] We could also spell out DC checks and bonuses for now (just to sanity check) as well as bonus damage/healing in general
[ ] Should at least be a _chance_ for AI to pick on someone other than weakest enemy
---
[ ] Better adventure module names (not just quest/saga/adventure of the $terrain...)
[ ] Display full statline in town + current effects
[ ] If you don't have enough to buy the quantity you like it should not say "You purchase X" (even if the next line is saying "not enough gold")
[ ] Should only be able to visit temple _once_ per long rest/visit in town
[ ] Found "letter" and "wanted poster" items could have clues about the dungeon boss (if not other bosses etc)
---
[ ] range vs melee action is good flavor but -- should take account of current weapon! bows shouldn't melee etc (have 'fixed' by adjusting starting equipment but should be a deeper solution)
[ ] Successful resistance should give a message ("successfully resisted...")
[ ] Should you roll your own poison damage? Feels strange -- maybe should just be automatic?
[ ] Poison damage should indicate who _inflicted_ it (this is sort of tracked but not surfaced...)
---
[ ] Unconscious allies shouldn't get XP?
[ ] Should reset abilities used on long rest? (why isn't this happening)
[ ] It would be nice to able to explore more freely (move back to previous rooms?)
[ ] Show party status before asking to rest
[ ] Losing a wandering monster battle should not leave you in the room waiting to decide what to do!
[ ] You should be able to visit the Inn even if at full HP?
---
[ ] Temple blessings should take account of the deity somehow... (war gods give toHit, love goddess grants chance to charm on hit etc)
---
[ ] Bring back status displays on the per turn overview...
[ ] Show full enemy name more often (we often default to just the forename ie 'minimal' combatant view with forename + HP but this is ... not very much information)
---
[ ] Player party _must_ be able to attempt to flee intentionally (could be a dex skill check?)
[ ] They should also have a chance to flee 'involuntarily' if they fail a save vs fear? (don't necessarily want to model 'splitting the party' but ... they could find individually-flown characters in previous rooms of the dungeon?)
[ ] Need save events (system-level SaveEvent propagated upward by save command handler to represent succeeding or failing a save roll)
[ ] Defend doesn't last long enough? Any effect with a duration of 1 only lasts until the end of the _current_ round (we moved to the end of the round for the check instead of individual turn beginning for clarity but maybe clearer to have co-located in flow with the individual combatant turn)
[ ] Why is save vs Bleed a will check? Seems weird?
[ ] Are we adding stat bonuses to save checks? (Probably not but maybe we should in at least some cases?)
[ ] Unconscious characters should not roll init
[ ] Some statuses still sound weird ("[defender] is Chaos by [inflicter]" - odd)
---
[ ] Align npc occupations with dungeon type ...
[ ] Show nicer character record with details/descriptions about traits
[ ] Show sources of passive/trait-based effects (awkward since we erase when we coalesce fx!)
[ ] Statuses like 'defending' really need to expire at end of next _turn_ not end of _round_
[ ] Humanize weapon names in damage description ("takes 5 damage from Valen's light_mace" => "Light Mace", maybe add damage type here?)
[ ] AI should not use buffs that only target allies if all allies are dead
[ ] "Heal 1 every successful hit" is too powerful ('vitalist' trait shared by all elves -- and note elves already get multiple very powerful passives?)
[ ] Dungeons with multiple floors (levels in principle seem relatively straightforward but we'd need to adapt dungeoneer to handle them...)
---
[ ] Set limit on saves vs death (3 per combat?)
[ ] Smite scaling 2d6 * level is way too powerful at higher levels

## Fixed
[x] Temple/shrine to local deity to get a blessing
[x] Healers healing themselves should say "X heals" not "X heals X"
[x] Healers should not heal when already at full HP
[x] Show current HP at start of round? Maybe each turn (we show on each turn now)
[x] Scale dungeon CR by level of party
[x] Magic missile sometimes seems fatal even when it deals less than total HP damage (not vs bosses??)
[x] Creatures that fall unconscious from poison should _not_ then attack!
[x] Is charge damage being applied correctly at all??? [it wasn't!]
[x] It still seems like npcs are dying at 1 HP somehow? But hard to pin down somehow [poison double damage...]
[x] Room names should not have underscores (throne_room) when presented to the player
[x] Should only be able to inspire if you have conscious allies
[x] Fear message should be clarified: "X is frightened" not "X is too frightened to act" since it may not be their turn at all (ie fear event isn't only used on failed flee anymore) [now just 'X is frightened']
[x] Finding rusted/silver/golden coins should grant XP bonus
[x] Make 'wait' the _last_ option in the action list... (adjusted hardcoded starting ability list but could be better!)
[x] Offer to take party to new dungeon if they beat it [sort of done with module gen]
[x] Only thieves/bandits/assassins should get daggers? (They're very strong with multiple attack die?) [only 1 attack die for daggers now]
[x] A "successfully resisted (effect)" message would be clarifying too (done)
[x] Effects could stack more nicely (we don't need 'poisoned' twice?) -- now deduped
[x] Abilities even for npcs should be limited by spell slots (seemingly done?)
[x] Is poison damage even being applied?? (I think it is???)
[x] Bring back 'flee'/battle escape abilities (enemies should be able to if they pass the dc check)
[x] Rolls should always indicate what die you are rolling... (i think this should be true now)
[x] Effect expiry say "no longer X" if you're still X from another version of the same effect (maybe more about stacking/aggregating effects properly) (effects should dedupe now)
[x] Make sure gold accumulated in dungeons is available in town (it is!)
[x] Special abilities should be rarer (thief shouldn't have poison cloud, _maybe_ assassin does) (think this should be true now)
[x] Maybe you have to consume potions to heal? (Or use cleric abilities...?) (should be limited to this now!)
[x] Maybe the PC hp curve should be flattened a bit too? (50 HP at level 5 seems like a lot??) (now follows normal hit die flow on level up...)
[x] Reset 'used abilities' list for PCs between battles so they can charge more than once!! (this should be happening now!)
[x] Charge ability for player warriors? Some buff/bless ability for clerics?? (implemented charge for warriors, bless for clerics)
[x] Enemies should have spell slots/dwindling resources (poison capsule could be a consumable for them -- can't just throw capsules all day!) (should now have slots and abilitiesUsed tracker...)
[x] Colorize stats consistently (ie when search/examine we should see the appropriate color for int/wis as in the statline rainbow) (done for search/examine!)
[x] Should be able to go back to a dungeon you _haven't_ completed yet... (think this is true now)

## Not really issues
"Rooms should remember if you've searched/examined things (ie not reset on wandering monster)" [maybe this is fixed but would be good to actually write down searched/examinedItems on the room?]
