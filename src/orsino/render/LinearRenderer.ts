// just a sketch for future UI state management
// import { GameEvent } from "../Events";

// type LinearUIState = {
//   currentLocation: string;
//   currentRoomDescription: string;
//   activeCombatants: { id: string; name: string; hp: number; maxHp: number }[];
//   combatLog: { turn: number; entry: string }[];
// };

// export default class LinearRenderer {
//   reduce(state: LinearUIState, event: GameEvent): LinearUIState {
//     switch (event.type) {
//       case "enterDungeon":
//       // case "enterShop":
//       case "enterRoom":
//         return {
//           ...state,
//           currentLocation: event.locationName,
//           currentRoomDescription: event.description,
//         };
//       case "combatantStatusChanged":
//         return {
//           ...state,
//           activeCombatants: state.activeCombatants.map(c => {
//             if (c.id === event.combatantId) {
//               return { ...c, hp: event.newHp };
//             }
//             return c;
//           }),
//         };
//       case "combatLogEntry":
//         return {
//           ...state,
//           combatLog: [...state.combatLog, { turn: event.turn, entry: event.entry }],
//         };
//       default:
//         return state;
//     }
//   }
// }