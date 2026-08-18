// SPDX-License-Identifier: GPL-3.0-only
/**
 * scanFrogInputAndDispatchHop  —  ROM 0x1acb  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The frog's steering. Once per vblank this routine reads the active player's joystick and turns it
 *   into motion: it decides whether the player is even allowed to move this frame, then continues a hop
 *   already underway or begins a new one. The frog travels in discrete 16-pixel hops; this routine is the
 *   thing that starts each hop and keeps an in-flight hop advancing frame by frame.
 *
 * WHERE IT SITS
 *   Run every frame from the in-play master orchestrator (orchestrateCollisionsAndFrogInput, 0x1a55) as
 *   the last step of the shared exit — reached whenever the frog is NOT on the home row (a frog that has
 *   climbed to the top routes to the goal handlers instead). Several other paths also tail here when they
 *   have nothing else to do: the home-row reject (holdFrogMissedHomeBay) and the goal handlers fall back
 *   to this scan while the frog has not fully arrived. So this is the default per-frame frog handler.
 *
 * LIVE-OUT
 *   Memory only. It writes the four directions' arrival/animation-counter cells on idle, decrements the
 *   hop-input timer, and hands off to begin/advance handlers that move the frog. It returns nothing the
 *   caller reads.
 *
 * THE MODEL
 *   Four directions — DOWN, UP, RIGHT, LEFT — are scanned in that FIXED priority order, and the first
 *   direction that acts returns immediately, so exactly one direction is serviced per frame and earlier
 *   directions win ties. For each direction the same three-way "triad" applies:
 *     1. that direction's hop is already active  → advance it one frame and return;
 *     2. else its joystick bit reads pressed      → begin a new hop and return;
 *     3. else it is idle                          → clear its arrival + animation cells, fall through.
 *   Because any active-or-pressed direction returns, holding one direction blocks every lower-priority
 *   direction, and DOWN (top of the order) can even start a fresh hop mid-flight, abandoning the one in
 *   progress. Joystick reads are ACTIVE-LOW: a CLEAR bit means the direction is pressed.
 */
import {
  HOLD_FLAG, ACTIVE_PLAYER, GATED_COUNTDOWN_ENABLE_FLAG, FROG_HOP_INPUT_TIMER,
  IN0_PORT, IN1_PORT, IN2_PORT,
  FROG_HOP_DOWN_ACTIVE, FROG_HOP_UP_ACTIVE, FROG_HOP_RIGHT_ACTIVE, FROG_HOP_LEFT_ACTIVE,
  FROG_HOP_DOWN_ARRIVAL, FROG_HOP_UP_ARRIVAL, FROG_HOP_RIGHT_ARRIVAL, FROG_HOP_LEFT_ARRIVAL,
  FROG_HOP_DOWN_ANIM_COUNTER, FROG_HOP_UP_ANIM_COUNTER, FROG_HOP_RIGHT_ANIM_COUNTER, FROG_HOP_LEFT_ANIM_COUNTER,
} from "./names.js";
import { loc_23eb } from "./loc_23eb.js";
import {
  beginFrogHopDown, advanceFrogHopDown, beginFrogHopUp, advanceFrogHopUp,
  beginFrogHopRight, advanceFrogHopRight, beginFrogHopLeft, advanceFrogHopLeft,
} from "./animateFrogHop.js";

// IN2_PORT (0xe004) bit 3 is the cabinet's cocktail-wiring bit: set on a cocktail cabinet, where players
// alternate on flipped views. It gates whether player-2 input routing engages at all.
const IN2_COCKTAIL_BIT = 0x08;

// DOWN and UP are wired differently for the two players. For player 1 both sit on IN2_PORT (0xe004): DOWN
// on bit 6, UP on bit 4. For player 2 DOWN moves to IN2 bit 0 and UP crosses entirely to IN0_PORT bit 0.
// DOWN_BIT_P2 and UP_BIT_P2 share the numeric value 0x01 but name distinct wires (IN2 bit0 vs IN0 bit0).
const DOWN_BIT_P1 = 0x40, UP_BIT_P1 = 0x10;
const DOWN_BIT_P2 = 0x01, UP_BIT_P2 = 0x01;

// The horizontal axis is uniform across players: RIGHT is bit 4 and LEFT is bit 5 of whichever "main port"
// the player owns (P1 = IN0_PORT 0xe000, P2 = IN1_PORT 0xe002).
const RIGHT_BIT = 0x10, LEFT_BIT = 0x20;

export function scanFrogInputAndDispatchHop(m) {
  const { mem8 } = m;

  // ── Gate 1: gated-countdown lockout ──────────────────────────────────────────────────
  // GATED_COUNTDOWN_ENABLE_FLAG (0x826c) fences off ALL frog steering while a gated countdown phase is
  // running. Non-zero → the frog is frozen this frame; bail before reading any joystick bit.
  if (mem8[GATED_COUNTDOWN_ENABLE_FLAG] !== 0) return;

  // ── Gate 2: hop-input hold-off timer ─────────────────────────────────────────────────
  // FROG_HOP_INPUT_TIMER (0x8268) is a countdown lock armed on the home-goal path (never during ordinary
  // land play, so this gate is transparent while hopping normally). While it counts, new joystick input is
  // ignored; each such frame only decrements the timer and steps the home-bay slot cursor via loc_23eb
  // (0x23eb), which advances HOME_BAY_SLOT_CURSOR (0x8123) mod 6. POKE-grounded: with the timer counting a
  // LEFT press produced no hop; a hop only occurred after it drained to 0.
  if (mem8[FROG_HOP_INPUT_TIMER] !== 0) {
    mem8[FROG_HOP_INPUT_TIMER] = mem8[FROG_HOP_INPUT_TIMER] - 1;
    return loc_23eb(m);
  }

  // ── Gate 3: hit/hold flag ────────────────────────────────────────────────────────────
  // HOLD_FLAG (0x8004) is the hit/hold flag raised when the frog is killed or otherwise held. While set,
  // the frog takes no input — bail.
  if (mem8[HOLD_FLAG] !== 0) return;

  // ── Player routing: pick the joystick to read ────────────────────────────────────────
  // p2 routing engages ONLY on a cocktail cabinet (IN2_COCKTAIL_BIT set) while player 2 is up
  // (ACTIVE_PLAYER 0x83fd != 1). In every upright/1P case p2 is false and we read player 1's wiring.
  // mainPort is the selected player's port for the HORIZONTAL axis (RIGHT/LEFT bits 4/5): P1 → IN0_PORT
  // (0xe000), P2 → IN1_PORT (0xe002). DOWN/UP are read separately below because they live on other ports.
  const p2 = (mem8[IN2_PORT] & IN2_COCKTAIL_BIT) !== 0 && mem8[ACTIVE_PLAYER] !== 1;
  const mainPort = p2 ? mem8[IN1_PORT] : mem8[IN0_PORT];

  // ── DOWN (highest priority) ──────────────────────────────────────────────────────────
  // Triad for DOWN. FROG_HOP_DOWN_ACTIVE (0x8248) set → a down-hop is mid-flight, so advance it and return
  // (DOWN outranks all, so this can pre-empt any lower direction). Else read the DOWN wire active-low (P1
  // IN2 bit6 / P2 IN2 bit0); a press begins a new down-hop. Else DOWN is idle: clear its one-hop latch
  // FROG_HOP_DOWN_ARRIVAL (0x824c) and its frame counter FROG_HOP_DOWN_ANIM_COUNTER (0x8250), then fall
  // through to UP.
  if (mem8[FROG_HOP_DOWN_ACTIVE] !== 0) return advanceFrogHopDown(m);
  const downPressed = p2 ? (mem8[IN2_PORT] & DOWN_BIT_P2) === 0 : (mem8[IN2_PORT] & DOWN_BIT_P1) === 0;
  if (downPressed) return beginFrogHopDown(m);
  mem8[FROG_HOP_DOWN_ARRIVAL] = 0;
  mem8[FROG_HOP_DOWN_ANIM_COUNTER] = 0;

  // ── UP ───────────────────────────────────────────────────────────────────────────────
  // An in-flight up-hop (FROG_HOP_UP_ACTIVE 0x8249) advances unconditionally — that comes BEFORE the guard
  // below, so the guard scopes only a fresh press.
  if (mem8[FROG_HOP_UP_ACTIVE] !== 0) return advanceFrogHopUp(m);
  // UP carries one extra condition on STARTING a hop: it may begin only when no horizontal hop is already
  // in flight — (FROG_HOP_RIGHT_ACTIVE 0x824a + FROG_HOP_LEFT_ACTIVE 0x824b) & 0xff === 0. This stops a
  // diagonal from turning an in-progress left/right hop into an up-hop. Inside the guard the usual triad
  // resumes: read UP active-low (P1 IN2 bit4 / P2 crosses to IN0 bit0); a press begins an up-hop, else
  // clear FROG_HOP_UP_ARRIVAL (0x824d) and FROG_HOP_UP_ANIM_COUNTER (0x8251).
  if (((mem8[FROG_HOP_RIGHT_ACTIVE] + mem8[FROG_HOP_LEFT_ACTIVE]) & 0xff) === 0) {
    const upPressed = p2 ? (mem8[IN0_PORT] & UP_BIT_P2) === 0 : (mem8[IN2_PORT] & UP_BIT_P1) === 0;
    if (upPressed) return beginFrogHopUp(m);
    mem8[FROG_HOP_UP_ARRIVAL] = 0;
    mem8[FROG_HOP_UP_ANIM_COUNTER] = 0;
  }

  // ── RIGHT ────────────────────────────────────────────────────────────────────────────
  // Triad for RIGHT on the horizontal axis. FROG_HOP_RIGHT_ACTIVE (0x824a) set → advance and return. Else
  // read RIGHT_BIT (bit 4) of the selected mainPort active-low; a press begins a right-hop. Else idle:
  // clear FROG_HOP_RIGHT_ARRIVAL (0x824e) and FROG_HOP_RIGHT_ANIM_COUNTER (0x8252).
  if (mem8[FROG_HOP_RIGHT_ACTIVE] !== 0) return advanceFrogHopRight(m);
  if ((mainPort & RIGHT_BIT) === 0) return beginFrogHopRight(m);
  mem8[FROG_HOP_RIGHT_ARRIVAL] = 0;
  mem8[FROG_HOP_RIGHT_ANIM_COUNTER] = 0;

  // ── LEFT (lowest priority) ───────────────────────────────────────────────────────────
  // Triad for LEFT, reached only when every higher direction was idle-and-unpressed. FROG_HOP_LEFT_ACTIVE
  // (0x824b) set → advance and return. Else read LEFT_BIT (bit 5) of mainPort active-low; a press begins a
  // left-hop. Else idle: clear FROG_HOP_LEFT_ARRIVAL (0x824f) and FROG_HOP_LEFT_ANIM_COUNTER (0x8253) and
  // fall out — nothing to do this frame.
  if (mem8[FROG_HOP_LEFT_ACTIVE] !== 0) return advanceFrogHopLeft(m);
  if ((mainPort & LEFT_BIT) === 0) return beginFrogHopLeft(m);
  mem8[FROG_HOP_LEFT_ARRIVAL] = 0;
  mem8[FROG_HOP_LEFT_ANIM_COUNTER] = 0;
}
