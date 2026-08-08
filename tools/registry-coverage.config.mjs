// SPDX-License-Identifier: GPL-3.0-only
// Per-game input to the wiring-invariant scan, kept OUTSIDE `games/` so a finished port can be
// governed without its tree being edited. A game absent here is scanned strictly.

/**
 * UNWIRED: modules NOT dispatched BY DECISION, keyed game -> module -> the reason.
 *
 * Legitimate only for a routine the override map cannot reach -- its argument arrives on the guest
 * stack, it never returns, it is not an entry point -- and only with its reason here: silence
 * reads exactly like the oversight this scan catches. A reason a reviewer cannot check is a fail.
 */
export const UNWIRED = {
  timeplt: {
    "loc_0030.js":
      "RST 0x30's argument IS the stack slot. The caller's transfer leaves the inline table's " +
      "address where a return address would sit, and the routine pops it -- consuming it is what " +
      "turns the caller's next bytes into a table instead of instructions. A dispatch entry takes " +
      "only the machine, so it would have to model that pop, which the memory-equivalence " +
      "contract keeps out of idiomatic code. Eight sites in translated/ reach it. Four are " +
      "already decompiled and ALL FOUR dissolved the transfer -- they read the inline table " +
      "directly and none of them calls this address -- so the route out is demonstrated, not " +
      "hoped for. The remaining four are frozen, and each dissolves it in its own unit by passing " +
      "the table address as an argument, at which point nothing here touches the stack.",
    "loc_0b93.js":
      "The foreground command-ring drain. It is a forever loop with no exit OF ITS OWN, and it cannot " +
      "be wired live: an idiomatic loop charges no T-states, so the vblank NMI never fires and " +
      "the machine hangs. It is also the poll PC the whole-machine gate yields the frame on, " +
      "declared in the game's manifest as convergence.pollPCs. Measured at its caller, and the " +
      "direction is the point: while this address stays UNWIRED the caller's m.call lands on the " +
      "oracle, which charges T-states, and the run makes its full frame budget; put the idiomatic " +
      "twin in that path instead and it produces no output at all.",
    "loc_3074.js":
      "Not a dispatch entry: it is an interior continuation. Decoding the image from EVERY byte " +
      "offset -- which over-generates and cannot under-generate -- finds exactly one transfer to " +
      "0x3074 in the whole 24KB, a `djnz` at 0x3081, and 0x307F..0x3089 is a CAPTION RECORD " +
      "(destination, colour, then glyph codes) rather than instructions, so that transfer is a " +
      "decode of data and not a real entry. The genuine way in is a fall-through from 0x306A, " +
      "four instructions that load the two coordinate registers off the sprite entry and point HL " +
      "at a table -- and 0x306A has no transcribed routine, which is why 0x3074 stands alone at " +
      "all. Both tapes dispatch it zero times, asserted in its gate. A ROUTINES entry would claim " +
      "an entry point the image does not have; it becomes dispatchable when 0x306A is lifted and " +
      "swallows it.",
    "loc_5254.js":
      "Not a dispatch entry: it is an interior continuation of destroyTargetsHitByShots, and the " +
      "frozen layer never transfers to it. A scan of the whole 24 KB for the little-endian word " +
      "0x5254, at every alignment, finds no occurrence, so no table can name it -- and the same " +
      "scan is shown able to find an entry point in the same breath, returning six occurrences of " +
      "0x5211's word, each behind a `c3`, `cd` or `c2`. Both paths in are interior to 0x5211's " +
      "own body: a `jr nz` at 0x5215 and the fall-through of the `djnz` at 0x5252. The frozen " +
      "transcription says the same thing by giving loc_5211 the range 0x5211-0x5269 and holding " +
      "0x5254-0x5269 a second time inside it, and loc_5211 reaches that stretch by falling into " +
      "it rather than by calling 0x5254. The idiomatic destroyTargetsHitByShots has already " +
      "SWALLOWED the continuation -- its own body reloads the two target cursors from 0xA991 and " +
      "0xA993 and the inner count from the shadow accumulator between passes, which is the whole " +
      "of what this module does -- so a ROUTINES entry would claim an entry point the image does " +
      "not have and override an address the enclosing routine's rewrite already covers.",
    "loc_562a.js":
      "Not a dispatch entry at all. The little-endian word for its address occurs nowhere in the " +
      "ROM image, so no table can name it, and every path in reaches it from a point interior to " +
      "another routine -- two conditional branches and a fall-through, all three of which have " +
      "idiomatic twins that call it directly. Its idiomatic form also takes the sound code as a " +
      "second parameter, which the override map has no way to supply.",
  },
};

/**
 * DEBT: modules ALREADY unwired the first time this guard ran for a game. Recorded, not blessed.
 *
 * ★ THE FINDING, not just a list. Every module below is COMMITTED, carries a green
 * equivalence-<addr> gate, is named by no ROUTINES entry, and is imported by no idiomatic sibling,
 * so nothing but its own test ever calls it and the frozen oracle runs at each address instead --
 * this is the Donkey Kong batch the method doc describes as accumulating unnoticed, still unwired.
 * Green gates are WHY it survived: a gate imports its module rather than dispatching to it.
 *
 * ★ NOT ESTABLISHED: what each one NEEDS. Some are leaves to wire, some should dissolve into the
 * caller that still m.calls them, and two -- loc_00ca, loc_02e3 -- are the computed-jp dispatchers
 * this game's override seam reaches outside `Machine.call`, where wiring may be wrong. No entry is
 * a verdict. Donkey Kong is a finished port; clearing this is a unit of work and Karl's to open.
 *
 * Checked as a SUBSET: a new one fails, removing an old one does not. Re-derive, never hand-edit.
 */
export const DEBT = {
  dkong: [
    "loc_00ca.js",
    "loc_02e3.js",
    "loc_0400.js",
    "loc_062a.js",
    "loc_1c05.js",
    "loc_1f8d.js",
    "loc_1fac.js",
    "loc_202f.js",
    "loc_2038.js",
    "loc_2053.js",
    "loc_2079.js",
    "loc_2083.js",
    "loc_20a2.js",
    "loc_20b5.js",
    "loc_20c3.js",
    "loc_20e1.js",
    "loc_2101.js",
    "loc_2118.js",
    "loc_2146.js",
    "loc_2153.js",
    "loc_215f.js",
    "loc_29af.js",
    "loc_2b1c.js",
  ],
};
