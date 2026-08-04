// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_00ca — run the handler one of the game's inline jump tables selected.
 *
 * Donkey Kong steers most of its per-frame control flow through inline jump tables: a caller
 * loads a selector, and a shared trampoline reads the little-endian target word out of a table
 * laid down beside the code and jumps to it. This routine is the far end of that jump — the
 * address registry behind those tables, turning a computed target address back into a call, so
 * that control flow the game expresses as data stays expressed as data. It takes its name from
 * the four-entry game-state table the vblank handler steers on: power-on, attract, credited,
 * in-game. Eleven further tables reach it, each naming itself through `site` so a gap can be
 * attributed to the table it fell out of.
 *
 * The listed targets ARE the contract, and they are a whitelist rather than a range check
 * because the game has neither: a selector that walks off the end of its table, or one that
 * picks a slot holding zero, produces an address like any other. Dispatching whatever routine
 * happens to be registered there would run plausible-looking garbage; refusing names it. The
 * null slots those tables carry are deliberately absent from the list below, because a null
 * slot IS the out-of-range case this refuses.
 *
 * Reads and writes no work RAM and touches no register: everything observable belongs to the
 * handler this dispatches.
 *
 * LIVE-OUT: the dispatched handler's return value, forwarded. That matters — the difficulty
 * guards among the targets return a keep-going boolean their caller consumes as an early
 * return, so swallowing it here would change behaviour.
 */

import { NotImplemented } from "../../../boards/dkong/io.js";

/**
 * Every target the wired inline jump tables vector to, grouped by the table whose words they are.
 * A few appear in two tables; each is listed once, under the first that reaches it.
 */
const DISPATCH_TARGETS = new Set([
  // The game-state table the vblank handler steers on.
  0x01c3, 0x073c, 0x08b2, 0x06fe,
  // The in-game sub-state table (29 slots, 6 of them null).
  0x0986, 0x09ab, 0x09d6, 0x09fe, 0x0a1b, 0x0a37, 0x0a63, 0x0a76, 0x0bda, 0x0c91, 0x123c, 0x127c,
  0x12f2, 0x1344, 0x138f, 0x13a1, 0x13aa, 0x13bb, 0x141e, 0x1486, 0x1615, 0x196b, 0x197a,
  // The attract/idle sub-state table.
  0x0763, 0x0779, 0x07c3, 0x07cb, 0x084b, 0x1977,
  // The credited state's two arms.
  0x08ba, 0x08f8,
  // The opening cutscene's step table.
  0x0a8a, 0x0abf, 0x0ae8, 0x0b06, 0x0b68, 0x0bb3, 0x3069,
  // The death-animation phase table.
  0x128b, 0x12ac, 0x12de,
  // The board-cleared render step tables — one for the odd boards, one for the even.
  0x1654, 0x1670, 0x168a, 0x16a3, 0x16bb, 0x1732, 0x1757, 0x178e,
  // The rivet-board interlude step table.
  0x17b6, 0x1839, 0x186f, 0x1880, 0x18c6,
  // The collision-response table.
  0x2880, 0x28b0, 0x28e0, 0x2901,
  // The difficulty guard table; these arms return a keep-going boolean, forwarded.
  0x3110, 0x311b, 0x3126, 0x3131,
  // The board-overlap search's per-board arms; its other three are the collision
  // table's, above.
  0x3e99,
]);

export function loc_00ca(m, target, site = "0x00CA (NMI game state)") {
  // A rewritten handler is invoked directly rather than through the routine table, and that is
  // load-bearing rather than a shortcut: it is how the engine's call-bracket seam recognises a
  // computed dispatch. Going through the table opens a call frame this dispatch never opened, and
  // the seam would then balance a bracket that is not there — a dispatched handler returns through
  // a continuation the DISPATCHER's own caller pushed, which is already open.
  if (m.overrides && m.overrides.has(target)) return m.overrides.get(target)(m);

  // Everything else goes through the machine's routine table, which is what keeps each handler
  // independently swappable at its address — the whole point of routing address-level control
  // flow through here instead of through a table of function references.
  if (DISPATCH_TARGETS.has(target)) return m.call(target);

  throw new NotImplemented(
    `handler at ROM 0x${target.toString(16).padStart(4, "0")} ` +
      `(reached via rst 0x28 table at ${site})`,
  );
}
