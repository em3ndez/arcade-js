// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { reinitRoundArenaAndPlayfieldIfImageIntact } from "./reinitRoundArenaAndPlayfieldIfImageIntact.js";
import {
  SUBPHASE_TICK,
  DISPLAY_LIST_SRC_PTR_ALT,
  DISPLAY_LIST_SRC_PTR,
  DISPLAY_LIST_DST_PTR_ALT,
  DISPLAY_LIST_DST_PTR,
  SELFTEST_DISPATCH_STATE,
  SELFTEST_REF_COPY_BOOT,
  ATTRACT_LIST_SRC_ALT_SEED,
  ATTRACT_LIST_SRC_SEED,
  ATTRACT_LIST_DST_SEED,
  PLAYFIELD_PAINT_START,
  BOOT_CODE_BASE,
  SELFTEST_LOOP2_SCAN_BASE,
} from "./names.js";
/**
 * seedDisplayListPointersAndVerifyRomSignature — attract/self-test state 0.
 *
 * WHAT IT IS
 *   The state-0 handler of the attract/self-test state machine. Before a game is started the
 *   machine idles on its attract screen, and a tiny state selector decides which piece of attract
 *   housekeeping runs on this pass. `dispatchSelfTestState` masks the selector
 *   SELFTEST_DISPATCH_STATE (0x8921) to its low two bits and routes here when it reads 0.
 *
 * ROLE IN THE MACHINE
 *   This one pass does two unrelated jobs:
 *     (1) it seeds the attract display-list state — the two source/destination pointer pairs the
 *         display-list interpreter walks to paint a whole playfield layout, plus the sub-phase
 *         tick — so the attract screen has a valid layout to draw; then
 *     (2) it advances the selector to state 1 and runs a two-stage integrity check of the program
 *         ROM, comparing live code against verbatim reference copies held elsewhere in the same ROM.
 *
 * ROM: 0x744e (0x744e–0x7499).
 * Grounding: [seen].
 *
 * LIVE-OUT (memory):
 *   • SUBPHASE_TICK (0x88b7) = 0 — the attract display sub-phase timer restarts from phase 0.
 *   • DISPLAY_LIST_SRC_PTR_ALT (0x88ba) = 0x43e1 and DISPLAY_LIST_SRC_PTR (0x8f45) = 0x4af0 — the
 *     two ROM read pointers (graphic stream / layout stream) the interpreter reads the attract
 *     layout from.
 *   • DISPLAY_LIST_DST_PTR_ALT (0x88b8) = 0x8442 and DISPLAY_LIST_DST_PTR (0x8f43) = 0x8042 — the
 *     two video-RAM write cursors (tile-plane paint start / colour-map cell) the interpreter paints
 *     the layout into.
 *   • SELFTEST_DISPATCH_STATE (0x8921) incremented 0 → 1, so the next dispatch runs state 1.
 *   The signature check itself leaves nothing behind on an intact ROM (it returns); a divergence in
 *   its second stage abandons this handler and enters the screen re-init path instead of returning.
 */
const LOOP1_COUNT = 0x08; //   loop 1: the eight boot bytes at ROM 0x0000..0x0007
const LOOP2_COUNT = 0x74; //   loop 2: the 0x74-byte program window at ROM 0x0092..0x0105

export function seedDisplayListPointersAndVerifyRomSignature(m, ix = m.regs.ix) {
  const { mem8 } = m;

  // ── Seed the attract display-list state ──────────────────────────────────────────────────────
  // The display-list interpreter paints a whole playfield layout by streaming bytes from a ROM
  // source pointer into a video-RAM destination pointer; there are two such pairs (a primary and
  // an alternate), and both must point at the attract layout before the first paint. Start by
  // clearing the sub-phase tick (0x88b7) so the attract animation begins at phase 0.
  mem8[SUBPHASE_TICK] = 0x00;
  // Alternate source pointer (0x88ba) <- 0x43e1: the ROM graphic-stream read pointer for the
  // attract layout, written low byte then high byte (the machine stores it little-endian).
  mem8[DISPLAY_LIST_SRC_PTR_ALT] = ATTRACT_LIST_SRC_ALT_SEED;
  mem8[DISPLAY_LIST_SRC_PTR_ALT + 1] = ATTRACT_LIST_SRC_ALT_SEED >> 8;
  // Primary source pointer (0x8f45) <- 0x4af0: the ROM layout-stream read pointer for the attract
  // layout (little-endian, low byte then high byte).
  mem8[DISPLAY_LIST_SRC_PTR] = ATTRACT_LIST_SRC_SEED;
  mem8[DISPLAY_LIST_SRC_PTR + 1] = ATTRACT_LIST_SRC_SEED >> 8;
  // Alternate destination pointer (0x88b8) <- 0x8442 (PLAYFIELD_PAINT_START): the video-RAM cell in
  // the tile plane where the attract paint begins (top-left of the playfield square).
  mem8[DISPLAY_LIST_DST_PTR_ALT] = PLAYFIELD_PAINT_START;
  mem8[DISPLAY_LIST_DST_PTR_ALT + 1] = PLAYFIELD_PAINT_START >> 8;
  // Primary destination pointer (0x8f43) <- 0x8042: a colour/attribute-map cell on the 0x8000
  // plane, the write cursor for the primary destination.
  mem8[DISPLAY_LIST_DST_PTR] = ATTRACT_LIST_DST_SEED;
  mem8[DISPLAY_LIST_DST_PTR + 1] = ATTRACT_LIST_DST_SEED >> 8;
  // Advance the self-test selector 0 -> 1. The dispatcher masks 0x8921 to two bits, so the next
  // dispatch will run state 1 (the attract driver) rather than re-running this seed pass.
  mem8[SELFTEST_DISPATCH_STATE] = mem8[SELFTEST_DISPATCH_STATE] + 1; // advance the selector

  // ── Two-stage program-ROM signature check ────────────────────────────────────────────────────
  // The machine guards against a tampered or failing program ROM by comparing live code against
  // verbatim reference copies kept elsewhere in the same ROM. The reference is read as one
  // continuous block: 0x749a..0x74a1 backs stage 1, and 0x74a2 onward backs stage 2. `ref` walks
  // forward through stage 1 and carries straight on into stage 2 (it is never reloaded).
  //
  // Loop 1: the first eight boot bytes vs their reference copy.
  //   ref = the reference copy of the boot bytes (ROM 0x749a),
  //   src = the live boot code (ROM 0x0000),
  //   count = eight bytes to compare.
  let ref = SELFTEST_REF_COPY_BOOT;
  let src = BOOT_CODE_BASE;
  let count = LOOP1_COUNT;
  let mismatch = false;
  for (;;) {
    // Any byte that differs flags a mismatch and breaks out early; otherwise step both pointers and
    // count the eight bytes down.
    if (mem8[src] !== mem8[ref]) { mismatch = true; break; }
    ref = u16(ref + 1);
    src = u16(src + 1);
    if (--count !== 0) continue;
    break;
  }
  if (!mismatch) { //                    clean loop 1: reseat the loop-2 walk (ref carries straight on)
    // Point the stage-2 scan at the program window base (ROM 0x0092) and load its 0x74-byte count.
    // `ref` is left untouched so it continues from 0x74a2. (A stage-1 mismatch skips this reseat and
    // falls into stage 2 with the entry scan pointer and count, where the first bad byte trips the
    // abort — a path an intact ROM never reaches, since stage 1 always matches.)
    ix = SELFTEST_LOOP2_SCAN_BASE;
    count = LOOP2_COUNT;
  }

  // Loop 2: the program window (ROM 0x0092..0x0105) vs its reference copy continuing at 0x74a2.
  // Any byte that differs abandons this pass and enters the screen re-init handler
  // reinitRoundArenaAndPlayfieldIfImageIntact (0x67df) instead of returning; an intact ROM matches
  // every byte and falls through to a plain return, having applied only the seed writes above.
  for (;;) {
    if (mem8[ix] !== mem8[ref]) return reinitRoundArenaAndPlayfieldIfImageIntact(m);
    ref = u16(ref + 1);
    ix = u16(ix + 1); // the hardware walks the low byte with a carry up: a 16-bit increment
    if (--count !== 0) continue;
    break;
  }
}
