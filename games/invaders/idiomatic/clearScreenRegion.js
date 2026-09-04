// SPDX-License-Identifier: GPL-3.0-only
import { clearScreenStrip } from "./clearScreenStrip.js";

/**
 * clearScreenRegion — blank a tall run of the framebuffer by looping the strip clearer.
 *
 * WHAT IT IS
 *   Repeatedly calls clearScreenStrip to zero the framebuffer from HL downward, one fixed-width strip at
 *   a time, until it reaches a terminator page. Space Invaders' framebuffer is rotated 90°: stepping the
 *   pointer by +0x20 crosses into the neighbouring column — a one-pixel-wide vertical strip — so
 *   clearScreenStrip(0x10) zeros a run of 16 column-bytes (16 pixels wide) and hands back the pointer
 *   0x200 further on (16 * 0x20). The eight-pixels-per-byte packing runs the other way, down each column.
 *
 * ROLE IN THE MACHINE
 *   The general region-blank primitive. Its identified caller is drawReserveLifeIcons, which draws the
 *   reserve-ship icons and then calls this to wipe everything below the last drawn icon down to the
 *   terminator row, so icons left over from a higher life count get erased. It writes only video RAM.
 *
 * ROM 0x19fa.  Grounding: [seen].
 *
 * LIVE-OUT: HL = the strip base that hit the terminator, A = its high byte (0x35), B = 0.
 */
export function clearScreenRegion(m, hl = m.regs.hl) {
  // Start the sweep at the caller's screen pointer.
  let cur = hl;
  // Blank one 16-column strip per pass. clearScreenStrip(0x10, cur) zeros 16 column-bytes from cur
  // (each +0x20 apart) and returns cur advanced by 0x200 to the start of the next strip. Continue until
  // the strip base has climbed into VRAM page 0x35xx — the terminator row that ends the region.
  do {
    cur = clearScreenStrip(m, 0x10, cur);
  } while (((cur >> 8) & 0xff) !== 0x35);
  // Publish the terminal pointer and the drained register state the Z80 tail left behind.
  return [(m.regs.hl = cur), (m.regs.a = (cur >> 8) & 0xff), (m.regs.b = 0)];
}
