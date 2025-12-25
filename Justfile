phb:
  echo "# Player's Handbook" > docs/phb.md; orsino book traits >> docs/phb.md; orsino book skills >> docs/phb.md; orsino book spells >> docs/phb.md

mm:
	echo "# Monster Manual" > docs/mm.md; orsino book monsters >> docs/mm.md

dmg:
	echo "# Dungeon Master's Guide" > docs/dmg.md
	orsino book planes >> docs/dmg.md
	orsino book wonders >> docs/dmg.md
	orsino book items >> docs/dmg.md
	orsino book statuses >> docs/dmg.md
	orsino book traps >> docs/dmg.md

books: phb mm dmg

pub: books
  mkdocs gh-deploy --clean