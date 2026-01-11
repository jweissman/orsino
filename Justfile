mm:
	echo "# Monster Manual" > docs/mm.md
	orsino book monsters >> docs/mm.md
	orsino book animals >> docs/mm.md

phb:
  echo "# Player's Handbook" > docs/phb.md; orsino book classes >> docs/phb.md; orsino book races >> docs/phb.md; orsino book gear >> docs/phb.md; orsino book armor >> docs/phb.md; orsino book weapons >> docs/phb.md; orsino book traits >> docs/phb.md; orsino book skills >> docs/phb.md; orsino book spells >> docs/phb.md

dmg:
	echo "# Dungeon Master's Guide" > docs/dmg.md
	orsino book planes >> docs/dmg.md
	orsino book wonders >> docs/dmg.md
	orsino book treasures >> docs/dmg.md
	orsino book items >> docs/dmg.md
	orsino book statuses >> docs/dmg.md
	orsino book traps >> docs/dmg.md

books: phb mm dmg

copy-index:
	cp index.docs.md docs/index.md

pub: books copy-index
  mkdocs gh-deploy --clean

test:
  bun test --watch --bail --timeout 60000