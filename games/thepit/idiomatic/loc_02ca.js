// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_02ca — one-time round-start setup: make the selected player's saved progress the
 * live state, configure the round from the dip switches, unmute the audio, build the
 * board screen and play the start sound, then hold an intro (repaint the two HUD panels
 * and one playfield strip over eight short frame-waits) before handing off to the
 * round-loop setup, which never returns here.  ROM 0x02ca.
 *
 * The sequence is:
 *   1. Load the selected player's saved level/score into the shared live cells.
 *   2. Decode the dip switches into the round's difficulty / hardware configuration.
 *   3. Switch the master sound-enable line on.
 *   4. Build the board screen for board mode 0x90 (clear sprites, repaint the tilemap,
 *      flood colour RAM, wipe the sprite staging block).
 *   5. Play the round-start sound.
 *   6. Paint the "MEN LEFT" HUD panel once, then hold the intro for eight passes: on
 *      each pass repaint the "PLAYERS" label and one playfield strip, spacing the passes
 *      with two short frame-waits (ten frames, then five). The pass count lives in the
 *      shared loop counter, drained to zero.
 *   7. Hand off to the round-loop setup — a tail jump whose own return carries this
 *      routine's caller, so control never comes back here.
 *
 * Which exact boundary this marks (new game vs. new level vs. player changeover) is not
 * pinned, so the name stays neutral; the sequence above is exactly what the code does.
 *
 * The board-screen build and the frame-waits keep their stack-return boundary — their
 * return is carried back through the work stack rather than a plain JS return — so each
 * is bracketed with the slot it pops; every other callee is already idiomatic and called
 * directly. The round-loop setup (0x031a) has no idiomatic form yet, so the closing tail
 * jump into it stays a registry call — a genuine oracle boundary.
 *
 * Memory-equivalent to the frozen oracle — equivalence-02ca.test.js.
 * GATE:     crafted-harness — validated on a real attract machine state (captured at a
 *           shared callee's dispatch). The frame-waits busy-wait on a per-frame countdown
 *           the interrupt drains in the live game; run in isolation that tick is modelled
 *           by one identical hook on both sides so the waits terminate, and the tail
 *           round-loop setup 0x031a (which never returns) is stubbed identically on both
 *           sides. The RAM diff excludes the dead stack-scratch window the dissolved calls
 *           no longer write. Teeth: a wrong intro pass count.
 * LIVE-OUT: memory-only — the loaded player block, the dip-config block, the board screen
 *           and HUD panels its callees paint, and the loop counter left at 0. No register
 *           or flag is read back: the routine tail-jumps into the round loop and the
 *           caller's return is carried by 0x031a.
 * NAMES:    LOOP_COUNTER (0x800a) from ram.js. 0x031a is the still-oracle round-loop
 *           setup (the tail target), kept hex.
 */

import { loadPlayerState } from "./loadPlayerState.js";
import { applyDipSwitches } from "./applyDipSwitches.js";
import { enableSound } from "./enableSound.js";
import { loc_4b40 } from "./loc_4b40.js";
import { requestSound4 } from "./requestSound4.js";
import { drawMenLeftPanel } from "./drawMenLeftPanel.js";
import { drawPlayerLabel } from "./drawPlayerLabel.js";
import { waitFrames } from "./waitFrames.js";
import { loc_4816 } from "./loc_4816.js";
import { LOOP_COUNTER } from "./ram.js";

export function loc_02ca(m) {
  const { mem8 } = m;

  // Bring up the round: make the selected player's saved progress live, configure the
  // round from the dip switches, unmute the audio, build the board screen, play the
  // round-start sound. The board-screen build returns through the work stack (its final
  // clear step carries the return), so it is handed the slot it pops, like a frame-wait;
  // the others are ordinary calls.
  loadPlayerState(m);
  applyDipSwitches(m);
  enableSound(m);
  m.push16(0x02d6);
  loc_4b40(m);
  requestSound4(m);

  // Hold the intro for eight passes. Arm the pass count and paint the "MEN LEFT" panel
  // once; then on each pass repaint the "PLAYERS" label and one playfield strip, spacing
  // the passes with a ten-frame and a five-frame wait (~two seconds of intro overall).
  mem8[LOOP_COUNTER] = 8;
  drawMenLeftPanel(m);
  do {
    drawPlayerLabel(m);
    m.push16(0x02e9); // the frame-wait returns through the work stack; push the slot it pops
    waitFrames(m, 10);
    loc_4816(m);
    m.push16(0x02f1);
    waitFrames(m, 5);
    mem8[LOOP_COUNTER] = mem8[LOOP_COUNTER] - 1;
  } while (mem8[LOOP_COUNTER] !== 0);

  // Hand off to the round-loop setup. Its own return carries this routine's caller, so
  // control never comes back here.
  return m.call(0x031a);
}
