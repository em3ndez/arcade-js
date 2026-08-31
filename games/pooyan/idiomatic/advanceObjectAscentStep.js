// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { resetToAttractScreenStart } from "./resetToAttractScreenStart.js";
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import { HUD_INTEGRITY_STRIP_B, ASCENT_CHECKSUM_REF, DISPLAY_CMD_0613 } from "./names.js";
/**
 * advanceObjectAscentStep — one per-frame step of a rising object's climb.
 *
 * WHAT IT IS
 *   A single object-state handler: the step that carries one object a little further up its
 *   vertical track each frame. It cycles the object's animation, moves the object, and — once
 *   the object clears a row threshold — advances the object's state and runs an integrity
 *   check over the on-screen HUD tile strip.
 *
 * ROLE IN THE MACHINE
 *   Runs once per frame while this object is in its ascent phase. On most frames it simply
 *   nudges the position and returns. The object's coarse row is the high byte of its 16-bit
 *   position: while that row sits at or above 0x1b the object has reached the top of its track
 *   and the handler returns immediately with nothing more to do. Once the row has dropped
 *   below 0x1b the handler advances the object's state index and verifies the HUD tile strip
 *   in video RAM (HUD_INTEGRITY_STRIP_B, 0x86bc) against the ROM reference bytes at
 *   ASCENT_CHECKSUM_REF (0x68a3): a corrupted strip drops the machine back to the attract
 *   screen, while an intact strip appends display command DISPLAY_CMD_0613.
 *
 * ROM: 0x6857-0x68a2.
 * Grounding: [seen].
 *
 * LIVE-OUT: none (memory only) — a void ascent handler on the record at IX. It updates the
 *   object record in place (16-bit position rec+5:rec+6, state index rec+2) and, when the row
 *   threshold is crossed, either re-enters attract or enqueues one display command.
 */
export function advanceObjectAscentStep(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Step the object's sprite animation one frame before it moves, so the climbing object
  // keeps its frame cycle in step with each ascent step.
  advanceObjectAnimationFrame(m, rec);

  // Ascend: subtract the per-step delta (rec+9) from the object's 16-bit vertical position,
  // stored little-endian as rec+5 (low byte) : rec+6 (high byte). Form the new low byte, and
  // when subtracting the delta underflows the low byte, propagate the borrow into rec+6.
  const lo = u8(mem8[rec + 5] - mem8[rec + 9]);
  if (mem8[rec + 5] < mem8[rec + 9]) mem8[rec + 6] = u8(mem8[rec + 6] - 1); // borrow into high
  mem8[rec + 5] = lo;

  // rec+6 is the object's coarse row. At or above row 0x1b the object has reached the top of
  // its track, so there is nothing further to do this frame.
  if (mem8[rec + 6] >= 0x1b) return; // reached the top

  // Below the threshold this frame: bump the object's state index (rec+2) into its next phase.
  mem8[rec + 2] = u8(mem8[rec + 2] + 1); // advance state

  // Integrity guard: fold the on-screen HUD tile strip together with a run of ROM reference
  // bytes and require the total to cancel to zero, catching a corrupted display. h:l walks the
  // video-RAM tile address starting at HUD_INTEGRITY_STRIP_B (0x86bc); de walks the paired ROM
  // reference table starting at ASCENT_CHECKSUM_REF (0x68a3); the running sum accumulates in c.
  let h = HUD_INTEGRITY_STRIP_B >> 8;
  let l = HUD_INTEGRITY_STRIP_B & 0xff;
  let de = ASCENT_CHECKSUM_REF;
  let c = 0;
  // Pass 1: eight tiles, stepping upward one screen row per tile (address -0x20), each tile
  // folded together with its ROM reference byte into the running sum c. Subtracting 0x20 from
  // the low byte l borrows into the high byte h at a row boundary.
  for (let b = 8; b > 0; b--) { // pass 1: -0x20 stride
    c = u8(mem8[de] + mem8[(h << 8) | l] + c);
    de = u16(de + 1);
    if (l < 0x20) h = u8(h - 1); // borrow
    l = u8(l - 0x20);
  }

  // Re-base the tile pointer to the second strip: drop the address high byte by 4 (address
  // -0x400) before the downward pass.
  h = u8(h - 4);
  // Pass 2: eight more tiles, stepping downward one screen row per tile (address +0x20), each
  // folded into the running sum c. Only the sum matters here, so the low byte l is held fixed —
  // the +0x20 is computed solely to carry into the high byte h at a row boundary and is never
  // stored back into l.
  for (let b = 8; b > 0; b--) { // pass 2: +0x20 (l is left unwritten)
    c = u8(mem8[(h << 8) | l] + c);
    if (l + 0x20 > 0xff) h = u8(h + 1); // carry
  }

  // Verify: add the trailing ROM reference byte (de now points just past the eight table
  // entries) to the running sum. A nonzero total means the HUD strip no longer matches its
  // reference — the display is corrupt — so drop back to the attract screen. Otherwise the
  // strip is intact and the handler appends display command DISPLAY_CMD_0613.
  if (u8(mem8[de] + c) !== 0) return resetToAttractScreenStart(m); // checksum mismatch -> re-enter
  enqueueDisplayCommand(m, DISPLAY_CMD_0613); // append the display command
}
