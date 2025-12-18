phb:
  echo "# Player's Handbook" > phb.md; orsino book traits >> phb.md; orsino book skills >> phb.md; orsino book spells >> phb.md

mm:
	echo "# Monster Manual" > mm.md; orsino book monsters >> mm.md

dmg:
	echo "# Dungeon Master's Guide" > dmg.md; orsino book items >> dmg.md

books: phb mm dmg
