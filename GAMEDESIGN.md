# Orsino Game Design Review

This document provides a high-level game design review of the Orsino project, focusing on its feature set, "play feel," and a potential roadmap for future development from a game design perspective.

## 1. Current Feature Set Analysis

The Orsino project currently functions as a powerful, OSR-style procedural generation engine that creates a wide variety of game elements.

*   **Core Engine:** The system excels at generating:
    *   **Characters & Monsters:** Detailed actors with classic six-stat ability scores, levels, classes, races, abilities, and descriptive, generated backstories. The combinatorial generation creates a huge bestiary from a smaller set of base components.
    *   **Environments:** Atmospheric dungeons composed of distinct rooms with descriptive text, suggesting a focus on exploration and setting.
    *   **Adventures:** The system can assemble the above elements into three distinct gameplay modes: `combat` (a tactical gauntlet), `dungeon` (a classic exploration crawl), and `module` (a more structured, narrative adventure).

*   **Governing Aesthetic:** The game's aesthetic is firmly rooted in the Old-School Revival (OSR) movement, which values:
    *   **High Lethality & High Stakes:** Combat is dangerous, and players are expected to think cleverly to overcome challenges.
    *   **Emergent Narrative:** The detailed generated descriptions provide strong hooks for stories to emerge organically through play.
    *   **Exploration & Discovery:** The focus on dungeon generation points to a core gameplay loop of exploring dangerous, unknown places.

## 2. Features to Enhance "Play Feel"

To deepen the OSR "play feel," the following features are proposed. The goal is to enhance emergent narrative, meaningful choice, and high-stakes exploration.

*   **Faction & Reputation System:** Introduce a small number of competing factions. Player actions would dynamically alter their reputation with these groups, transforming the world from a static collection of dungeons into a living, political landscape.
*   **Rumor & Information Gathering:** Gate the discovery of dungeons behind a rumor-gathering system in settlements. This would introduce an information-gathering loop that is central to the OSR experience and makes exploration feel more earned.
*   **Henchmen & Hirelings:** Allow players to recruit simple hirelings with generated personalities and morale scores. This would reinforce the human-scale, high-lethality aspect of OSR play by making party management a core strategic challenge.
*   **Meaningful Treasure & Downtime Activities:** Frame gold as a story-making resource. Introduce a "downtime" phase between adventures where players can spend their treasure on activities that have narrative consequences, such as carousing, establishing a base, or researching new abilities.

## 3. Proposed Game Design Roadmap

This roadmap prioritizes the proposed features into a logical progression, starting with the core gameplay loop and gradually building outward.

### Phase 1: Deepen the Dungeon

This phase focuses on making the core activity of dungeon exploration richer and more dynamic.

*   **1. Henchmen & Hirelings:** Directly enhances the core "dungeoneering" experience, reinforcing the OSR principles of high lethality and clever problem-solving.
*   **2. Rumor & Information Gathering:** Adds a crucial "pre-dungeon" phase that builds anticipation and makes exploration more meaningful.

### Phase 2: Build the World

With the core loop enhanced, this phase focuses on making the world feel like a living, breathing place.

*   **3. Faction & Reputation System:** Layers a dynamic, political landscape on top of the existing game, giving long-term consequences to the players' actions.
*   **4. Meaningful Treasure & Downtime Activities:** Provides the crucial "post-dungeon" phase, giving players a way to invest their treasure back into the world and create personal stakes.

### Phase 3: Expand the Horizon

This phase looks toward the "world mode" mentioned in the `README.md`, building on the systems established in the previous phases.

*   **5. Overland Travel & Exploration:** Introduce a simple system for traveling between known locations that can be expanded into a full hex-crawl exploration game.
*   **6. Settlement & Stronghold Building:** Expand the "downtime" activities into a more robust system where players can build up a home base and become significant players in the factional landscape.
