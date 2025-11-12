import Combat from './src/orsino/Combat';

async function runCombat() {
  console.log("=== Starting Combat Demo ===\n");

  let combat = new Combat({
    outputSink: console.log  // Use console.log to see the output
  });

  const initMessage = await combat.setUp(Combat.defaultTeams());
  console.log(initMessage);
  console.log("\n");

  while (!combat.isOver()) {
    const turn = await combat.nextTurn();
    console.log("\n");
  }

  console.log("\n=== Combat Complete ===");
  console.log(`Winner: ${combat.winner}`);
  console.log(`Total turns: ${combat.turnNumber}`);
}

runCombat();
