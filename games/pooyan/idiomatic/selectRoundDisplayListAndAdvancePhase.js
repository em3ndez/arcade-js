// SPDX-License-Identifier: GPL-3.0-only
import {
  PHASE_TIMER,
  PLAY_MODE_LATCH,
  PLAY_STATE_INDEX,
  SUBPHASE_TICK,
  ROUND_IN_PROGRESS,
  GAME_ACTIVE_FLAG,
  ROUND_COUNTER,
  DISPLAY_LIST_SRC_PTR,
  DISPLAY_LIST_SRC_PTR_ALT,
  DISPLAY_LIST_DST_PTR_ALT,
  DISPLAY_LIST_DST_PTR,
  ENEMY_SPAWN_TIMER,
  PLAYFIELD_PAINT_START,
  ATTRACT_LIST_DST_SEED,
  DLIST_GFX_ROUND_ODD,
  DLIST_LAYOUT_ROUND_ODD,
  DLIST_GFX_ROUND0,
  DLIST_LAYOUT_ROUND0,
  DLIST_GFX_LATCH_B1,
  DLIST_LAYOUT_LATCH_B1,
  DLIST_GFX_LATCH,
  DLIST_LAYOUT_LATCH,
  DLIST_GFX_ALT_EVEN,
  DLIST_LAYOUT_ALT_EVEN,
  DLIST_GFX_ALT_ODD,
  DLIST_LAYOUT_ALT_ODD,
  PHASE_SETUP_DISPLAY_CMD,
} from "./names.js";
import { armTileFillFromPlayfieldBase } from "./armTileFillFromPlayfieldBase.js";
import { paintPlayfieldAttributeMapForVariant } from "./paintPlayfieldAttributeMapForVariant.js";
import { renderPhaseGauge } from "./renderPhaseGauge.js";
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import { clearDisplayMsgBufOnRoundInitMatch } from "./clearDisplayMsgBufOnRoundInitMatch.js";
/**
 * selectRoundDisplayListAndAdvancePhase — ROM 0x16b7. Grounding: [seen].
 *
 * WHAT IT IS
 * ----------
 * This is the handler for sub-state index 1 of the in-play state machine. During a play
 * frame the machine dispatches on PLAY_STATE_INDEX (0x880a); index 1 sits between the
 * per-frame arena setup (index 0) and the intro hold (index 2), and its job is twofold:
 *   1. Impose a *timed hold* between the surrounding setup steps by counting a phase timer
 *      down, doing nothing until it expires.
 *   2. Once the hold elapses, decide *which pair of display-list streams* should paint the
 *      playfield for this round, publish that choice, seed the surrounding fixed state, and
 *      hand the frame on to the next sub-state.
 *
 * ROLE IN THE MACHINE
 * -------------------
 * The playfield is drawn from a "display list": a graphic stream (tile codes) paired with a
 * layout stream (where the tiles land). Different rounds and game modes want different
 * artwork, so this routine walks a small decision tree over the play-mode latch, the
 * round-in-progress flag, the game-active gate and the parity of the round counter, and from
 * that picks one of several (graphic, layout) pointer pairs baked into ROM. The pair it
 * chooses is left in the display-list source pointers for the interpreter that runs on a
 * later sub-state to consume. The routine never paints the screen itself; it only *selects*
 * and *arms* the paint.
 *
 * LIVE-OUT (memory only — nothing survives for a caller):
 *   - Every entry: PHASE_TIMER (0x8808) decremented by 1.
 *   - While the timer is nonzero: returns having done nothing else.
 *   - Bonus-path branch (play-mode latch bit0 set): PLAY_STATE_INDEX (0x880a) := 0x10, then return.
 *   - Normal expiry branch:
 *       SUBPHASE_TICK (0x88b7) := 0
 *       DISPLAY_LIST_SRC_PTR (0x8f45)     := chosen layout-stream pointer
 *       DISPLAY_LIST_SRC_PTR_ALT (0x88ba) := chosen graphic-stream pointer
 *       DISPLAY_LIST_DST_PTR_ALT (0x88b8) := PLAYFIELD_PAINT_START (0x8442)
 *       DISPLAY_LIST_DST_PTR (0x8f43)     := ATTRACT_LIST_DST_SEED (0x8042)
 *       ENEMY_SPAWN_TIMER (0x8d07)        := 0x20
 *       PLAY_STATE_INDEX (0x880a)         += 1  (advance to index 2)
 *       a display command (0x0683) enqueued into the display-command ring.
 */

const SPAWN_TIMER_SEED = 0x20;

export function selectRoundDisplayListAndAdvancePhase(m) {
  const { mem8, mem16 } = m;

  // Step 1 — the timed hold. PHASE_TIMER (0x8808) is a per-frame countdown reloaded by an
  // earlier setup step; here it is decremented (kept to a byte) and, while it has not yet
  // reached zero, the routine returns immediately. This is what spaces the round's setup
  // steps out over successive frames instead of running them all in one burst.
  const t = (mem8[PHASE_TIMER] - 1) & 0xff;
  mem8[PHASE_TIMER] = t;
  if (t !== 0) return; // hold still in effect — nothing more this frame

  // Step 2 — per-phase setup, run once the hold expires. First re-arm the row-by-row tile
  // fill from the fixed playfield base, then paint the playfield colour/attribute map for
  // the current field variant. Together these prepare the tilemap and colour RAM the display
  // list will write into.
  armTileFillFromPlayfieldBase(m);
  paintPlayfieldAttributeMapForVariant(m);

  // Step 3 — bonus-stage diversion. PLAY_MODE_LATCH (0x8f50) is a multi-valued play-state
  // latch; its bit 0 marks the bonus/eagle path. When it is set, skip the whole display-list
  // selection and instead force the sub-state to 0x10 (index 16, the bonus-stage arming
  // countdown), routing the round down the bonus branch.
  if (mem8[PLAY_MODE_LATCH] & 0x01) {
    mem8[PLAY_STATE_INDEX] = 0x10; // divert to the bonus-stage handler
    return;
  }

  // Step 4 — normal-path preamble. Clear SUBPHASE_TICK (0x88b7), the period-0x1c frame tick
  // the following intro sub-state waits on, so that timer starts fresh; then render the phase
  // gauge (the 5-cell vertical HUD counter drawn from the phase counter).
  mem8[SUBPHASE_TICK] = 0x00;
  renderPhaseGauge(m);

  // Read the two selectors the decision tree keys on: the play-mode latch (re-read after the
  // setup above) and the round counter. ROUND_COUNTER (0x8907) bit 0 selects the stage-type /
  // facing variant and bit 1 gates a further latch-path variant.
  const latch = mem8[PLAY_MODE_LATCH];
  const round = mem8[ROUND_COUNTER];

  // Step 5 — pick the (graphic, layout) display-list pointer pair. `gfx` becomes the
  // graphic-stream pointer and `layout` the layout-stream pointer; `useAlt` marks the cases
  // that fall through to the shared "alternate" artwork chosen further down by round parity.
  let gfx, layout;
  let useAlt = false;

  if (latch === 0) {
    // Latch clear = ordinary play. The choice then depends on the round's live gates:
    if (mem8[ROUND_IN_PROGRESS] !== 0) {
      // A round is already running — use the shared alternate artwork.
      useAlt = true;
    } else if (mem8[GAME_ACTIVE_FLAG] === 0) {
      // Not in an active game (e.g. attract) — also the shared alternate artwork.
      useAlt = true;
    } else if (round & 0x01) {
      // Fresh odd-numbered round — the odd-round display list.
      gfx = DLIST_GFX_ROUND_ODD;
      layout = DLIST_LAYOUT_ROUND_ODD;
    } else if (round === 0) {
      // The very first round (round 0) — the round-0 display list.
      gfx = DLIST_GFX_ROUND0;
      layout = DLIST_LAYOUT_ROUND0;
    } else {
      // Fresh even round other than 0 — the shared alternate artwork.
      useAlt = true;
    }
  } else if (round & 0x02) {
    // Latch set and round-counter bit 1 set — the latch-path, bit1 variant.
    gfx = DLIST_GFX_LATCH_B1;
    layout = DLIST_LAYOUT_LATCH_B1;
  } else {
    // Latch set and round-counter bit 1 clear — the plain latch-path variant.
    gfx = DLIST_GFX_LATCH;
    layout = DLIST_LAYOUT_LATCH;
  }

  // Step 5b — resolve the shared alternate artwork by round parity (bit 0): even rounds and
  // odd rounds get distinct graphic/layout streams. This is the single point where all the
  // `useAlt` cases above converge.
  if (useAlt) {
    if ((round & 0x01) === 0) {
      gfx = DLIST_GFX_ALT_EVEN;
      layout = DLIST_LAYOUT_ALT_EVEN;
    } else {
      gfx = DLIST_GFX_ALT_ODD;
      layout = DLIST_LAYOUT_ALT_ODD;
    }
  }

  // Step 6 — commit the choice and seed the surrounding fixed state.
  //  - DISPLAY_LIST_SRC_PTR (0x8f45): layout (where tiles land) read pointer for the interpreter.
  //  - DISPLAY_LIST_SRC_PTR_ALT (0x88ba): graphic (tile codes) read pointer for the interpreter.
  //  - DISPLAY_LIST_DST_PTR_ALT (0x88b8): destination cursor seeded to the video-RAM playfield
  //    start (0x8442), where the paint begins.
  //  - DISPLAY_LIST_DST_PTR (0x8f43): the paired destination pointer seeded to the colour-map
  //    cell (0x8042).
  //  - ENEMY_SPAWN_TIMER (0x8d07): the enemy spawn-cadence countdown primed to 0x20.
  mem16[DISPLAY_LIST_SRC_PTR] = layout;
  mem16[DISPLAY_LIST_SRC_PTR_ALT] = gfx;
  mem16[DISPLAY_LIST_DST_PTR_ALT] = PLAYFIELD_PAINT_START;
  mem16[DISPLAY_LIST_DST_PTR] = ATTRACT_LIST_DST_SEED;
  mem8[ENEMY_SPAWN_TIMER] = SPAWN_TIMER_SEED;
  mem8[PLAY_STATE_INDEX] = mem8[PLAY_STATE_INDEX] + 1; // advance to sub-state index 2 (intro hold)

  // Step 7 — enqueue the phase-setup display command (0x0683) into the display-command ring
  // so the main loop acts on the freshly-armed display list, then run the message-buffer
  // compare that clears the round-init display message when its pattern matches.
  enqueueDisplayCommand(m, PHASE_SETUP_DISPLAY_CMD);
  clearDisplayMsgBufOnRoundInitMatch(m);
}
