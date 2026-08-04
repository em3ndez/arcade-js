// SPDX-License-Identifier: GPL-3.0-only
/**
 * raise50mObjectAndPark — one idle-then-retract tick for a BOARD_OBJ_SCRATCH object, resetting it
 * to state 0 when it reaches the TOP of its travel.  ROM 0x22A2.
 *
 * VERTICAL CONVENTION — GROUNDED 2026-08-02 against the real dkong ROM in MAME 0.288, because
 * the prose here used to have it exactly backwards. The position counter is a SCREEN Y: it is
 * published into a sprite record's byte +3, and LARGER Y IS LOWER ON SCREEN.
 *
 * The decisive measurement is a direct pixel mapping: with every sprite in the shadow buffer
 * blanked but this object's slot, forcing its +3 byte to 40 / 104 / 120 / 200 puts the lone
 * remaining sprite at image rows 32..47 / 96..111 / 112..127 / 192..207 of the 224x256 frame. The
 * byte maps 1:1 to the image row, larger lower.
 *
 * Corroborating, measured on a 130-second credited 50m board:
 *   - MARIO_Y (0x6205) equals his sprite record's byte +3 on 6418/6418 in-play frames, so the
 *     sprite Y byte carries the object-record convention exactly.
 *   - This object's record field +3 at frame N equals its sprite cell at frame N+1 on 7408/7409
 *     frames. NOTE THE LAG: it is NOT an exact same-frame identity (that holds on only
 *     7009/7410), because the sprite buffer reflects the record as of the previous frame at the
 *     point these samples are taken. An earlier draft asserted the same-frame form.
 *   - The state cycle, traced on that board: s0 parks at 0x68; s1 spans 0x68..0x77 (advancing at
 *     0x78); s2 sits only at 0x78; s3 spans 0x78..0x69, resetting at 0x68.
 *
 * So counter 0x68 (the minimum) is the object's HIGHEST point and 0x78 (the maximum) is its
 * LOWEST. Stepping the counter DOWN moves the object UP the screen.
 *
 * PROVENANCE, because it decides how much each line above is worth. The three bullets are the
 * author's own measurements, re-derived when this note was written. THE PIXEL MAPPING IS NOT: it
 * is an independent reviewer's, obtained with a write tap on the i8257 DRQ latch (0x7D85) that
 * rewrites the sprite buffer immediately before the DMA transfer. The author's own attempt at it
 * — blanking the buffer from the frame notifier — silently does not work, because the game refills
 * the buffer before the transfer, so it produced no usable control. Review also corrected the
 * original argument for the convention, which rested on Mario's spawn Y quoted as 238 when the
 * spawn value is 240. The conclusion survived unchanged, on different evidence than it was first
 * argued from.
 *
 * The full cycle across the four states is therefore: parked at the top, extend DOWN, dwell at the
 * bottom, retract back UP, park. (That is the motion of a retracting ladder, and mechanisms.md
 * lists retracting ladders among the 50m board's cast — but the object has not been identified
 * against pixels, so the names deliberately say "object" and claim no identity.)
 *
 * One arm of the dispatch50mObjectState object state machine, entered with a pointer to the object's
 * record — one of the two 8-byte BOARD_OBJ_SCRATCH records the dispatcher selects by
 * frame parity. The record base arrives on the stack; here it is an honest parameter.
 *
 * Field +4 is a per-tick countdown: it is decremented every time this arm runs, and
 * until it underflows to zero the object simply idles for this tick. On the tick it
 * underflows, the countdown is reloaded and the object's position counter (field +3) is
 * stepped DOWN by one, then that new position is mirrored into the object's on-screen
 * sprite position cell (via publish50mObjectYToSprite, which routes it to one of two sprite slots by the
 * pointer's bit 3). When the position counter reaches the top of its travel (0x68 — its minimum,
 * so the object's highest point on screen),
 * the object is reset: field +1 is set to 0x80 and the state byte (field +0) is cleared,
 * sending the object back to state 0 of the state machine. The sibling arm slide50mObjectDown is
 * the mirror image — it steps the same counter UP toward 0x78 and advances the state.
 *
 * Every field address is taken within the record's own memory page (the original pointer
 * walk steps only the low byte), so a field access never crosses a page boundary.
 *
 * Memory-equivalent to the frozen oracle — equivalence-22a2.test.js.
 * GATE:     crafted, exhaustive by factorisation. The dispatch50mObjectState board gate is closed
 *           in attract, so this arm never dispatches there (0 natural in 2000 frames).
 *           ★ DISCLOSURE (pass 15): the old text went on to say "and real captures are
 *           unavailable". That is now FALSE — a credited 50m board dispatches this arm freely,
 *           and the state cycle was traced live on one (s0 @0x68 -> s1 up to 0x78 -> s2 dwell ->
 *           s3 back to 0x68 -> s0; 6483 record-initialised frames in that run, 2834 of them with
 *           the object actively cycling). THIS GATE REPLAYS NONE OF THEM; it remains
 *           a crafted sweep, which is sound but is not the same thing as replaying real
 *           dispatches, and a future pass should capture them. The observable effect factorises
 *           into the idle
 *           path (depends only on the countdown) and the fire path (depends only on the
 *           position counter), each swept over all 256 values on BOTH real records — which
 *           between them exercise both sprite slots (bit 3 clear / set). Teeth: a wrong
 *           reload twin, a counter-goes-up twin, and a dropped reset-write twin.
 * LIVE-OUT: memory-only — the object-machine cascade that tail-calls this arm discards its
 *           residual registers/flags, and its terminal return is dead ABI. The record base
 *           it takes on the stack becomes a parameter, and the display-mirror call is a
 *           direct call, so the oracle's push/return bracket around that call is dropped —
 *           its dead scratch write lands in STACK_SCRATCH, excluded by the equivalence gate.
 * NAMES:    the record base is a BOARD_OBJ_SCRATCH (0x6280) record, passed in — the routine
 *           hardcodes no absolute cell. Fields +0/+1/+3/+4 are addressed relative to it; the
 *           two sprite destination cells live inside the publish50mObjectYToSprite callee (unnamed in names.js).
 */

import { publish50mObjectYToSprite } from "./publish50mObjectYToSprite.js"; // ROM 0x22BD — display mirror

/**
 * @param {object} m          the machine (uses m.mem only).
 * @param {number} recordBase base pointer of the object's record (a BOARD_OBJ_SCRATCH
 *                            record — 0x6280 or 0x6288).
 * @returns {void}
 */
export function raise50mObjectAndPark(m, recordBase) {
  const { mem } = m;

  // Address of record field N, kept on the record's own page (the pointer walk steps only
  // the low byte, so a field address never crosses a page boundary).
  const field = (n) => (recordBase & 0xff00) | ((recordBase + n) & 0xff);

  // Field +4 — per-tick countdown. Step it down every tick; idle until it underflows.
  const countdown = (mem.read8(field(4)) - 1) & 0xff;
  mem.write8(field(4), countdown);
  if (countdown !== 0) return;

  // Underflowed: reload the countdown and step the position counter (+3) DOWN by one.
  mem.write8(field(4), 0x02);
  const position = (mem.read8(field(3)) - 1) & 0xff;
  mem.write8(field(3), position);

  // Mirror the new position into this object's on-screen sprite position cell.
  publish50mObjectYToSprite(m, field(3));

  // Still retracting upward — stop until the counter reaches its minimum (the top of travel).
  if (position !== 0x68) return;

  // Top of travel reached: reset the object — field +1 to 0x80, then the state byte (+0) to 0,
  // returning it to state 0 of the object state machine.
  mem.write8(field(1), 0x80);
  mem.write8(field(0), 0x00);
}
