# Notes from Playtesting

[ ] Finding rusted/silver/golden coins should grant XP bonus
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
[ ] Enemies should have spell slots (poison capsule could be a consumable for them?)

## Fixed
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
[x] Fear message should be clarified ("X is frightened" not "X is too frightened to act" since it may not be their turn at all (ie fear event isn't only used on failed flee anymore) [now just 'X is frightened']

## Not really issues
"Rooms should remember if you've searched/examined things (ie not reset on wandering monster)"
