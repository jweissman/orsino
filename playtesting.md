# Notes from Playtesting

[ ] Loot should be accumulated ("X takes it" = added to a list on their pc record)
[ ] Offer to take party to new dungeon if they beat it
[ ] Maybe you can leave an offering (5gp) at a shrine for a blessing?
[ ] Only thieves/bandits/assassins should get daggers? (They're very strong with multiple attack die?)
---
[ ] Load all PCs on party select so we can show their race/class
---
[ ] A room generated with multiple monsters with the same name (humans may need more names as a race but also maybe we could _specifically_ try to prevent this?)
[ ] CR scaling still not working great for deeper rooms?
[ ] Maybe 20 should be stat max until level 10?
[ ] A "successfully resisted (effect)" message would be clarifying too
[ ] High-level enemies should have much higher dex??
[ ] Effects could stack more nicely (we don't need 'poisoned' twice?)
---
[ ] Rest could reset status effects? (would be nice to do this _before_ persisting PCs?)
[ ] A spell that causes stun could be interesting (flesh-to-stone would be neat too?)
[ ] Healing potion could cure poison status too?
[ ] Poisoned blade still has weird expiration message actually? ("X is no longer poisoned blade"; a bit awkward to fix since a standard message would be ideal here)
[ ] Might be good/wise/prudent to gather status effects into constants so we're not subject to (as many) typo bugs!
[ ] Target CR for the dungeon was 4 but first three rooms all had CR 3??
[ ] Maybe you have to consume potions to heal? (Or use cleric abilities...?)
[ ] Unify search/examine (should both have chance to find potions and both grant XP on success)
[ ] Duplicate forenames still problematic -- maybe 'forename' can just _be_ magical within deem (genList could identify and toss dupes to prevent issues like this -- may cause other problems and seems weird... adding some gross genUniqListByKey seems 'too heavy' too; or we could have a 'gather' function that grabs all values of the __items but the expression then just gets too gnarly; note technically it's not even the 'name' key but 'forename' which ... we could just have a much deeper list to draw from to prevent this happening so often but that doesn't really solve this fundamentally!)
[ ] A cage could have a chance to have a prisoner (who could become ally); incidentally would be nice for it to be more likely within a 'cell' room
[ ] Maybe the PC hp curve should be flattened a bit too? (50 HP at level 5 seems like a lot??)
[ ] Enemies should have spell slots/dwindling resources (poison capsule could be a consumable for them -- can't just throw capsules all day!)
---
[ ] Enemy AC seems _really_ low -- a character with high dex is always getting 0 or less to hit! (maybe fixed by giving them armor?)
[ ] Larger rooms could give more search opps?
[ ] Adventuring kit could be a consumable that is needed to give first aid?
[ ] Found treasure should be redeemable for gold
---
[ ] Remind players to rest if they're not at full health going into boss battle?
[ ] Make sure gold accumulated in dungeons is available in town
---
[ ] Healing for 0 HP should be presented as a failure (not "heals for 0 damage" but "tried to heal but fails")
[ ] Charge ability for player warriors? Some buff/bless ability for clerics??
[ ] Temple blessing should _recharge_ duration if already present (ie just having the blessing should not necessarily disable prayer)
[ ] Should be able to see what active effects you have even in town
[ ] Would be interesting to distinguish between positive/negative effects (maybe rest should cure only bad things?)
[ ] Effect expiry say "no longer X" if you're still X from another version of the same effect (maybe more about stacking/aggregating effects properly)
[ ] Colorize stats consistently (ie when search/examine we should see the appropriate color for int/wis as in the statline rainbow)
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
[ ] Reset 'used abilities' list for PCs between battles so they can charge more than once!! (this should be happening now!)

## Fixed
[x] Temple/shrine to local deity to get a blessing
[x] Healers healing themselves should say "X heals" not "X heals X"
[x] Healers should not heal when already at full HP
[x] Show current HP at start of round? Maybe each turn
[x] Scale dungeon CR by level of party
[x] Magic missile sometimes seems fatal even when it deals less than total HP damage (not vs bosses??)
[x] Creatures that fall unconscious from poison should _not_ then attack!
[x] Is charge damage being applied correctly at all??? [it wasn't!]
[x] It still seems like npcs are dying at 1 HP somehow? But hard to pin down somehow [poison double damage...]
[x] Room names should not have underscores (throne_room) when presented to the player
[x] Should only be able to inspire if you have conscious allies
[x] Fear message should be clarified: "X is frightened" not "X is too frightened to act" since it may not be their turn at all (ie fear event isn't only used on failed flee anymore) [now just 'X is frightened']
[x] Finding rusted/silver/golden coins should grant XP bonus

## Not really issues
"Rooms should remember if you've searched/examined things (ie not reset on wandering monster)"
