// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1c33 — the airborne handler's exit tail: on the one arrival value whose bump wraps the
 * byte to zero, run the hammer-touch latch; then, always, refresh Mario's sprite record and
 * return.  ROM 0x1C33.
 *
 * Two paths in the still-frozen airborne handler (ROM 0x1C05) arrive here, and both are present
 * in real attract dispatches:
 *
 *   - THE COUNTER PATH (76 of 77 measured dispatches). The handler has just measured how far
 *     MARIO_AIR_FRAMES is from the land-check trigger of 20 and branched here because the two
 *     differ — the arc is still in flight. The arrival value is therefore MARIO_AIR_FRAMES − 20,
 *     so the bump wraps to zero on exactly one airborne frame: MARIO_AIR_FRAMES == 19, the frame
 *     before the handler arms the fall-height check. That is the frame the hammer-touch latch
 *     runs on, which is why latchHammerTouch fires roughly once per jump rather than once per
 *     frame — one hammer test per airborne arc.
 *
 *   - THE COLLISION FALL-THROUGH (1 of 77). The handler's object-overlap block ran and reported
 *     a hit, and the block leaves the arrival value at 1 on its way out (it has just latched
 *     ITEM_COLLECTED / EFFECT_STATE / EFFECT_SELECT). A bump of 1 cannot wrap, so the latch can
 *     never run from this path — a collision frame never tests for a hammer touch here.
 *
 * The sprite-record refresh is unconditional and is the movement machine's universal tail: every
 * path through the Z80 mover ends there. In the ROM this routine reaches it by a jump rather than
 * a call, so that tail's return is this routine's return — one net caller-return on both arms.
 *
 * Order between the two callees is not load-bearing: the latch and the sprite refresh share no
 * cell (the latch writes MARIO_HAMMER_PENDING, the item/score sound trigger and the touched
 * hammer record; the refresh reads Mario's live fields and writes his sprite record), so swapping
 * them is invisible — the ROM's order is kept anyway.
 *
 * REGISTER-ABI MARSHALLING (dissolves once ROM 0x1C05 is decompiled): the arrival value is a
 * genuine register live-in and its only setter is the frozen oracle handler, which dispatches
 * here through the registry with no arguments — so it is read out of the register file at entry
 * rather than taken as a parameter.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1c33.test.js.
 * GATE:     captured + crafted-exhaustive. 0x1C33 IS naturally reachable and the gate MEASURES
 *           it: 77 real dispatches in 2000 plain-attract frames, 4 of them on the wrapped arm
 *           that runs the latch (every one with MARIO_AIR_FRAMES == 19, asserted) and 73 on the
 *           plain arm, with both arrival paths above represented. Because the whole live-in is a
 *           single byte, the gate then sweeps ALL 256 arrival values on a real captured state —
 *           twice, once with the latch pre-set so a latch call CLEARS it and once with a hammer
 *           overlapping Mario so a latch call SETS and marks it — which pins the predicate
 *           exactly rather than sampling it: exactly 1 of 256 values runs the latch, asserted on
 *           the oracle side. Crafted arms additionally pin the closed board gate (75m) and the
 *           four cells' ABSOLUTE values, so a both-sides-wrong reading cannot pass. Teeth: a
 *           dropped sprite refresh (caught on 60 of the 77 real dispatches), an unconditional
 *           latch (29/77), a never-latch twin and an off-by-one predicate. The last two are
 *           caught on crafted baits, and — measured, not assumed — on only 2 of the 4 real
 *           wrapped dispatches, because on unpoked attract state the latch usually rewrites the
 *           values already there; that is exactly why the baits exist.
 * LIVE-OUT: memory-only. The bumped value is consumed only by the wrap test here; nothing
 *           downstream reads it, because the tail is writeMarioSpriteRecord, whose own live-out
 *           is memory-only, so the oracle's residual accumulator/pointer/flags are dead. pc and
 *           SP net to exactly ONE caller-return on both arms — on the wrapped arm with the board
 *           gate closed, the latch's oracle returns through its rst-0x30 skip, which consumes the
 *           bracket this routine's oracle pushed instead — so the gate compares them too, with
 *           the harness performing the single return the idiomatic form models as a JS return.
 *           The oracle's bracket bytes land in STACK_SCRATCH (measured at a real wrapped
 *           dispatch: SP enters at 0x6BEC and the deepest push reaches 0x6BE4, inside the
 *           [0x6BE0, 0x6C00) region), which the memory compare excludes.
 * NAMES:    none imported — this routine reads and writes no memory cell of its own; every cell
 *           named above is touched by its callees or by the caller that sets the arrival value.
 *           Direct-called: latchHammerTouch (ROM 0x2954) and writeMarioSpriteRecord (ROM 0x1DA6),
 *           both already idiomatic. No m.call remains.
 */

import { u8 } from "../../../core/int.js";
import { latchHammerTouch } from "./latchHammerTouch.js";           // ROM 0x2954
import { writeMarioSpriteRecord } from "./writeMarioSpriteRecord.js"; // ROM 0x1DA6

/**
 * @param {object} m  the machine. Live-in: the airborne handler's arrival value, in the register
 *   file (see the marshalling note above). Live-out: memory only.
 */
export function loc_1c33(m) {
  const { regs } = m;

  // Bump the handler's arrival value. The wrap to zero is the whole selector: on the counter
  // path it means the airborne frame counter sits one frame short of the land-check trigger.
  const bumped = u8(regs.a + 1);
  if (bumped === 0) latchHammerTouch(m);

  // The mover's universal tail — Mario's freshly-computed state into his sprite record.
  writeMarioSpriteRecord(m);
}
