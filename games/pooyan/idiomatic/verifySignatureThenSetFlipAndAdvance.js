// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { advanceActorState2AndCapWaveArrival } from "./advanceActorState2AndCapWaveArrival.js";
import { STATE5_SIGCHECK_CODE_BASE_ADDR, STATE5_SIGCHECK_REF_TOP } from "./names.js";
/**
 * verifySignatureThenSetFlipAndAdvance — state-5 handler for an actor record in the 0x8a80 actor
 * array. ROM 0x2a96-0x2ab2. Grounding: [seen].
 *
 * WHAT IT IS
 *   Every actor in the game is one fixed-size record inside the 0x8a80 actor array, and each frame
 *   the actor sweep re-dispatches a record on its own state byte (rec+0x02). Those state values index
 *   the actor secondary-state jump table (0x28f1); this routine is entry 5 of that table — the handler
 *   a record runs while it sits in state 5. `rec` is the record being serviced (the machine points IX
 *   at it). Before the handler does any of its record work it runs a 0x20-byte program-signature check:
 *   it reads one fixed run of program bytes and compares it, byte for byte, against a second fixed copy
 *   of those same bytes that the ROM keeps stored in reverse. On a genuine, unaltered image the two
 *   always agree; a single mismatch means the code has been changed.
 *
 * ROLE IN THE MACHINE
 *   One of the anti-tamper tripwires woven through the actor states. It is a passive self check on the
 *   program image, folded into an ordinary per-frame state handler so it runs during normal play rather
 *   than only at boot. On the intact image it behaves as a plain "advance" step: it reseats the record's
 *   frame-hold dwell, sets the sprite horizontal-flip bit, and moves the record on to the next state so
 *   the actor sweep services it differently next frame. On a mismatch it does none of that — it instead
 *   hands the frame to the state-2 handler advanceActorState2AndCapWaveArrival, whose own integrity gate
 *   is what actually diverts the tampered machine.
 *
 *   The checked run is the first 0x20 bytes of the screen re-init routine reinitRoundArenaAndPlayfieldIfImageIntact
 *   (its entry is at STATE5_SIGCHECK_CODE_BASE_ADDR / ROM 0x67df), read low-to-high. The reference is a
 *   copy of those same bytes laid down in reverse, whose top is STATE5_SIGCHECK_REF_TOP (ROM 0x2b23),
 *   read high-to-low — so walking the code up and the reference down in lockstep compares byte i of the
 *   code against byte i of the copy.
 *
 * LIVE-OUT (memory it leaves behind on the clean path)
 *   - rec+0x11 (frame-hold dwell)   = 0x18
 *   - rec+0x10 (flag byte)          bit7 (horizontal-flip) set
 *   - rec+0x02 (state byte)         incremented by one
 *   None of these are returned; the actor sweep re-reads the record next frame. On the mismatch branch
 *   the routine writes nothing itself — it tail-jumps the state-2 handler and forwards that handler's
 *   result unchanged. That branch is dead on a genuine image: both compared runs are fixed program bytes
 *   that ordinary play cannot alter, so the compare always falls through to the clean writes.
 */

const HOLD_FIELD = 0x11; //   record offsets: frame-hold / flag / state
const FLAG_FIELD = 0x10;
const STATE_FIELD = 0x02;
const FRAME_HOLD_RESEED = 0x18;
const FLIP_BIT = 0x80;
const SIGCHECK_LEN = 0x20;

export function verifySignatureThenSetFlipAndAdvance(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Set up the two walk pointers and the byte count for the signature check. `ref` starts at the top of
  // the reversed reference copy (STATE5_SIGCHECK_REF_TOP / ROM 0x2b23) and will walk DOWN; `src` starts
  // at the base of the checked code window (STATE5_SIGCHECK_CODE_BASE_ADDR / ROM 0x67df) and will walk
  // UP. Because the reference is stored back-to-front, walking one down and the other up keeps them
  // pointing at the same logical byte of the program. `count` is the 0x20-byte length to compare.
  // ROM 0x2a96-0x2a9c (ld hl,0x67df; ld de,0x2b23; ld b,0x20).
  let ref = STATE5_SIGCHECK_REF_TOP; //  reversed reference, read downward
  let src = STATE5_SIGCHECK_CODE_BASE_ADDR; // checked code window, read upward
  let count = SIGCHECK_LEN;
  for (;;) {
    // Compare this pair of bytes. On the genuine image every reference byte equals its code byte and the
    // loop runs to completion. A single inequality means the program image differs from its stored copy:
    // abandon the check and tail-jump the state-2 handler advanceActorState2AndCapWaveArrival, forwarding
    // its return so nothing below this point runs. ROM 0x2a9e-0x2aa0 (ld a,(de); sub (hl); jp nz,0x2a01).
    if (mem8[ref] !== mem8[src]) return advanceActorState2AndCapWaveArrival(m, rec); // tamper -> state-2 handler
    // Step the reference down and the code window up to the next matched pair. ROM 0x2aa3-0x2aa4
    // (inc hl; dec de).
    ref = u16(ref - 1);
    src = u16(src + 1);
    // Count this byte off; loop until all 0x20 have matched, then fall through to the clean-path writes.
    // ROM 0x2aa5 (djnz 0x2a9e).
    if (--count !== 0) continue;
    break;
  }

  // Signature intact — perform the state-5 record edits.
  // Reseat the frame-hold dwell (rec+0x11) to 0x18: the countdown that pins the record in its current
  // animation pose for a fixed number of frames before the next advance. ROM 0x2aa7 `ld (ix+0x11),0x18`.
  mem8[rec + HOLD_FIELD] = FRAME_HOLD_RESEED;
  // Set bit7 of the record's flag byte (rec+0x10) — the horizontal-flip bit read by the sprite renderer,
  // so the actor is drawn mirrored while in this state. ROM 0x2aab `set 7,(ix+0x10)`.
  mem8[rec + FLAG_FIELD] |= FLIP_BIT;
  // Advance the record's state byte (rec+0x02) by one, so next frame the actor sweep dispatches this
  // record through the following jump-table entry instead of back here. ROM 0x2aaf `inc (ix+0x02)`.
  mem8[rec + STATE_FIELD] = mem8[rec + STATE_FIELD] + 1; // advance the state byte
}
