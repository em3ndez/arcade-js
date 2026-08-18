// SPDX-License-Identifier: GPL-3.0-only
/**
 * awardHomeBayGoal — the shared goal handler for all five home bays
 *   ROM 0x1d87 / 0x1dd8 / 0x1e29 / 0x1e7a / 0x1ecb  (awardHomeBay1Goal..awardHomeBay5Goal)
 *   grounding: [code]
 *
 * WHAT IT IS
 *   The routine that awards a home bay when the frog reaches the top row and lands in one of the five
 *   bay columns. Frogger's board finishes at five home bays across the top row; each bay is won once,
 *   and filling all five completes the board (and grants an extra life). Awarding a bay means: pay any
 *   fly bonus, stamp the "frog in home" graphic, reset the frog for its next trip, and flip that bay's
 *   won/empty gate so it counts toward board completion.
 *
 *   All five bay handlers are ONE parameterized body. Every bay runs identical logic and differs only
 *   in four constants — its pair of occupancy-gate cells, its on-screen Y, its fly-bonus key, and its
 *   home-tile VRAM base — collected in the BAY1..BAY5 tables below. The exported awardHomeBay{1..5}Goal
 *   thunks just call the shared body with the matching table, mirroring the five ROM entry points.
 *
 * WHERE IT SITS
 *   Reached from selectHomeBayGoalHandler (the column dispatcher). Once the frog climbs into the top
 *   region, that dispatcher matches the frog's X against one of five column bands and jumps to the
 *   corresponding bay entry here. This routine then decides the outcome: a bay already won does nothing;
 *   a frog not yet fully on the home row is handed to the input scan; otherwise the bay is AWARDED.
 *
 * LIVE-OUT
 *   Memory only. It writes this bay's occupancy gate and this player's home count, and — through the
 *   helpers it calls — the score, the goal-celebration sprite, and the home tiles. It returns nothing
 *   the caller reads.
 */
import {
  ACTIVE_PLAYER, FROG_Y, COLLISION_SUBFLAG, PENDING_HOME_BAY_SLOT, PLAYER1_SLOT, PLAYER2_SLOT,
  HOME_BAY1_OCCUPANCY_PRIMARY, HOME_BAY1_OCCUPANCY_ALT,
  HOME_BAY2_OCCUPANCY_PRIMARY, HOME_BAY2_OCCUPANCY_ALT,
  HOME_BAY3_OCCUPANCY_PRIMARY, HOME_BAY3_OCCUPANCY_ALT,
  HOME_BAY4_OCCUPANCY_PRIMARY, HOME_BAY4_OCCUPANCY_ALT,
  HOME_BAY5_OCCUPANCY_PRIMARY, HOME_BAY5_OCCUPANCY_ALT,
  HOME_SLOT1_VRAM, HOME_SLOT2_VRAM, HOME_SLOT3_VRAM, HOME_SLOT4_VRAM, HOME_SLOT5_VRAM,
} from "./names.js";
import { scanFrogInputAndDispatchHop } from "./scanFrogInputAndDispatchHop.js";
import { armHomeGoalSprite } from "./armHomeGoalSprite.js";
import { awardBonusPoints } from "./awardBonusPoints.js";
import { stampHomeGoalAndResetFrog } from "./stampHomeGoalAndResetFrog.js";

// The frog "fully reached the home row" only once FROG_Y (0x8047) has climbed above (numerically below)
// this threshold. At or past 0x2a the frog is still short of the home row, so no award is made yet.
const HOME_ROW_Y = 0x2a;

// Per-bay parameter tables. Each of the five bays supplies:
//   gateP1 — this bay's occupancy gate in the PRIMARY bank, read/written when ACTIVE_PLAYER (0x83fd) == 1.
//            HOME_BAY{n}_OCCUPANCY_PRIMARY (0x825e..0x8262). Nonzero = bay already won.
//   gateP2 — the same gate in the ALTERNATE bank, used for the other player (ACTIVE_PLAYER != 1).
//            HOME_BAY{n}_OCCUPANCY_ALT (0x8263..0x8267). The two banks give each player an independent set.
//   bayY   — this bay's on-screen Y (0x18, 0x48, 0x78, 0xa8, 0xd8 for bays 1..5). Doubles as the fly-bonus
//            popup position (awardBonusPoints) and the goal-sprite lead byte (armHomeGoalSprite).
//   key    — this bay's 1-based fly-bonus key (1..5), matched against PENDING_HOME_BAY_SLOT (0x8121), which
//            names the bay currently showing the fly/creature.
//   slot   — this bay's home-tile VRAM base (HOME_SLOT{n}_VRAM), where the 2x2 "frog in home" tiles land.
const BAY1 = { gateP1: HOME_BAY1_OCCUPANCY_PRIMARY, gateP2: HOME_BAY1_OCCUPANCY_ALT, bayY: 0x18, key: 0x01, slot: HOME_SLOT1_VRAM };
const BAY2 = { gateP1: HOME_BAY2_OCCUPANCY_PRIMARY, gateP2: HOME_BAY2_OCCUPANCY_ALT, bayY: 0x48, key: 0x02, slot: HOME_SLOT2_VRAM };
const BAY3 = { gateP1: HOME_BAY3_OCCUPANCY_PRIMARY, gateP2: HOME_BAY3_OCCUPANCY_ALT, bayY: 0x78, key: 0x03, slot: HOME_SLOT3_VRAM };
const BAY4 = { gateP1: HOME_BAY4_OCCUPANCY_PRIMARY, gateP2: HOME_BAY4_OCCUPANCY_ALT, bayY: 0xa8, key: 0x04, slot: HOME_SLOT4_VRAM };
const BAY5 = { gateP1: HOME_BAY5_OCCUPANCY_PRIMARY, gateP2: HOME_BAY5_OCCUPANCY_ALT, bayY: 0xd8, key: 0x05, slot: HOME_SLOT5_VRAM };

function awardHomeBayGoal(m, p) {
  const { mem8 } = m;

  // ── Step 1: is this bay already won? ─────────────────────────────────────────────────
  // Pick the active player's bank for this bay — the primary gate when ACTIVE_PLAYER (0x83fd) is 1, the
  // alternate gate otherwise — and read it. A nonzero gate means the bay is already filled, so there is
  // nothing to award: return, leaving the won bay untouched.
  if (mem8[mem8[ACTIVE_PLAYER] === 1 ? p.gateP1 : p.gateP2] !== 0) return;

  // ── Step 2: has the frog actually reached the home row? ──────────────────────────────
  // FROG_Y (0x8047) at or past HOME_ROW_Y (0x2a) means the frog is still short of the top row. In that
  // case we do not award yet — we defer to the ordinary per-frame input scan so the frog keeps hopping.
  if (mem8[FROG_Y] >= HOME_ROW_Y) return scanFrogInputAndDispatchHop(m);

  // ── Step 3: fly-bonus key match ──────────────────────────────────────────────────────
  // PENDING_HOME_BAY_SLOT (0x8121) names the bay currently displaying the fly/creature. If it equals this
  // bay's key (subtract and mask to 0), the frog landed in the very bay showing the fly, so we pay the
  // bonus via awardBonusPoints (bay Y = popup position). That helper is gated on the creature-stamp mirror:
  // when a stamp is mid-cycle it raises HOLD_FLAG and returns truthy — a skip signal telling us to abort
  // the rest of the award this frame — so we return; when clear it writes the popup, arms the goal sprite,
  // adds the BCD 0x20 bonus, and returns falsy so we fall through and finish the award.
  if (((mem8[PENDING_HOME_BAY_SLOT] - p.key) & 0xff) === 0 && awardBonusPoints(m, p.bayY)) return;

  // ── Step 4: stamp the home graphic and reset the frog ────────────────────────────────
  // Stamp the 2x2 "frog in home" tiles at this bay's slot base and reset the frog object for its next
  // trip (queues the arrival jingle, advances the fanfare, and reseeds the frog off-screen). See
  // stampHomeGoalAndResetFrog.
  stampHomeGoalAndResetFrog(m, p.slot);

  // ── Step 5: settle a latched collision ───────────────────────────────────────────────
  // If a collision was latched into COLLISION_SUBFLAG (0x8134) — the frog reached home riding a creature
  // that was flagged — arm the goal-celebration sprite at this bay's Y and clear the sub-flag so the
  // latch does not carry into the next frog.
  if (mem8[COLLISION_SUBFLAG] !== 0) {
    armHomeGoalSprite(m, p.bayY);
    mem8[COLLISION_SUBFLAG] = 0;
  }

  // ── Step 6: mark the win ─────────────────────────────────────────────────────────────
  // Flip this bay's active-bank occupancy gate to 1 (so it now reads "won" everywhere that tests it) and
  // bump the active player's home tally — PLAYER1_SLOT (0x825c) or PLAYER2_SLOT (0x825d). That tally is
  // what the per-frame service watches: at 5 it takes the board-completion / extra-life branch.
  if (mem8[ACTIVE_PLAYER] === 1) {
    mem8[p.gateP1] = 1;
    mem8[PLAYER1_SLOT] = mem8[PLAYER1_SLOT] + 1;
  } else {
    mem8[p.gateP2] = 1;
    mem8[PLAYER2_SLOT] = mem8[PLAYER2_SLOT] + 1;
  }
}

// The five ROM entry points (0x1d87, 0x1dd8, 0x1e29, 0x1e7a, 0x1ecb): each selects its bay's parameter
// table and runs the shared body above.
export function awardHomeBay1Goal(m) { return awardHomeBayGoal(m, BAY1); }
export function awardHomeBay2Goal(m) { return awardHomeBayGoal(m, BAY2); }
export function awardHomeBay3Goal(m) { return awardHomeBayGoal(m, BAY3); }
export function awardHomeBay4Goal(m) { return awardHomeBayGoal(m, BAY4); }
export function awardHomeBay5Goal(m) { return awardHomeBayGoal(m, BAY5); }
