// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_186a — stamp the actor's fixed animation frame, then run the shared cell/tile tail.  ROM 0x186a.
 *
 * One of a family of thin prologues the movement/state dispatcher jumps to: each writes a
 * different animation frame code into the actor's sprite-frame byte and then hands off to the
 * same position/tile tail. This one always picks frame code 52. Its sibling loc_1864 instead
 * alternates between two adjacent frames; here the frame is unconditional.
 *
 * The shared tail rebuilds the actor's on-screen video-RAM cell from its position counters,
 * reads the tile currently under it, and dispatches on that tile. The tail never returns to
 * here — it tail-jumps onward and its eventual return unwinds straight to this routine's own
 * caller — so handing off to it is this routine's own return.
 *
 * The frame written here is a DEFAULT: on most tiles the tail's classifier recomputes the
 * actor's frame from the tile and direction and overwrites it, so the stamp is dead on nearly
 * every attract path (live on 1 of ~521 dispatches — the tile there routes past the classifier
 * and the stamp survives to be drawn). The stamp is still the routine's one distinctive act;
 * what visual pose frame 52 depicts is not grounded, so the name stays neutral rather than
 * assert a walk/turn/dig pose it might not be.
 *
 * Memory-equivalent to the frozen oracle — equivalence-186a.test.js.
 * GATE:     real captured attract dispatches — RAM-only diff vs the oracle over the states the
 *           dispatcher actually produces (0x186a fires ~521× in a plain attract run). Teeth: a
 *           twin that skips the tail hand-off (caught by the tail's writes), and a wrong-frame
 *           twin on the one real captured state where the stamp survives (caught at 0x8069).
 *           Reached from the movement/state dispatcher.
 * LIVE-OUT: memory — the sprite-frame byte plus everything the shared tail writes — and the
 *           tail's control flow. No live registers of its own (the tail overwrites the
 *           accumulator before reading it, and no caller reads a register back).
 * NAMES:    SPRITE_CODE (0x8069). The shared tail loc_186f has no idiomatic file yet, so it is
 *           still reached through the frozen oracle at its ROM address.
 */

import { SPRITE_CODE } from "./ram.js";

export function loc_186a(m) {
  const { mem8 } = m;

  // Choose this prologue's fixed animation frame; the draw code renders the actor with it.
  mem8[SPRITE_CODE] = 52;

  // Hand off to the shared tail: rebuild the actor's screen cell, read the under-tile, and
  // dispatch on it. Its return unwinds to this routine's caller, so it is our return too.
  // loc_186f is still the frozen oracle (no idiomatic file yet).
  return m.call(0x186f);
}
