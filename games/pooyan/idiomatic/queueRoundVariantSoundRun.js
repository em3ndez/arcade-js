// SPDX-License-Identifier: GPL-3.0-only
import { appendSoundCommandRun } from "./appendSoundCommandRun.js";
import { ROUND_COUNTER } from "./names.js";
/**
 * queueRoundVariantSoundRun — queue the round-variant sound-command run.
 *
 * WHAT IT IS
 *   A tiny sound-command selector: it derives one of four consecutive command bytes
 *   (0x22, 0x23, 0x24, 0x25) from the current round and hands that byte to the shared
 *   run-append helper, which frames it into a complete sound-command run.
 *
 * ITS ROLE IN THE MACHINE
 *   The audio processor is fed indirectly, through a 28-slot sound-command ring in page
 *   0x8a that the frame service pays out one byte per frame. This routine is one of the
 *   many small "selector" producers that put bytes into that ring: it names WHICH sound
 *   plays, and lets the run-append helper attach the fixed framing trailer. The choice is
 *   made from ROUND_COUNTER (0x8907) so the sound has a round-dependent variant — as the
 *   game progresses through rounds the selected command walks across the four adjacent
 *   codes, giving four flavours of the same effect. Because the append helper routes every
 *   byte through the play-live gate, this whole run is queued only while a game is running
 *   (or the play-mode latch is set) and is dropped wholesale while the machine is idle.
 *
 * ROM 0x0fa2-0x0fac. Grounding tag: [seen].
 *
 * LIVE-OUT: A = the advanced sound-ring write-cursor left by the run-append helper's final
 * append (0 when the play-live gate is shut and the bytes were dropped). The helper leaves
 * that value in the A register, the caller reads it, and returning the helper's result here
 * carries it straight through.
 */

// Base of the four consecutive sound-command bytes: selector 0 -> 0x22, up to selector 3 -> 0x25.
const TILE_CODE_BASE = 0x22;
// Two-bit mask isolating the 0..3 round-variant selector after the round counter is shifted down.
const SELECTOR_MASK = 0x03;

export function queueRoundVariantSoundRun(m) {
  const { mem8 } = m;
  // Fold ROUND_COUNTER (0x8907) into a 0..3 selector: shift the round number down by one so
  // that bits 1 and 2 of the counter fall into bit positions 0 and 1, then mask to those two
  // bits. Bit 0 of the round counter (which selects a stage-type/facing variant elsewhere) is
  // discarded, so the selector advances one step for every two rounds and wraps every eight.
  const selector = (mem8[ROUND_COUNTER] >> 1) & SELECTOR_MASK;
  // Bias the selector onto the command-byte base to pick the round's variant (0x22..0x25) and
  // hand it to the shared run-append helper, which appends this leading byte followed by the
  // fixed framing trailer 0x15/0x16/0x17 into the sound-command ring — all through the play-live
  // gate, so the run is either fully queued or fully dropped. Its result (the advanced ring
  // write-cursor) is returned unchanged as this routine's live-out A.
  return appendSoundCommandRun(m, TILE_CODE_BASE + selector);
}
