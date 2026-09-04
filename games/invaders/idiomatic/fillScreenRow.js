// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";

/**
 * fillScreenRow — the framebuffer fill primitive: store one byte across a run of columns.
 *
 * WHAT IT IS
 *   Takes a byte value, a pass count, and a start address, then repeatedly stores the value and
 *   advances the pointer by 0x20 each pass, leaving the pointer one stride past the end. Video RAM is
 *   organized as 32-byte columns, so adding 0x20 crosses into the neighbouring column; stepping that
 *   way lays the value down across successive columns — a line spanning the screen width.
 *
 * ROLE IN THE MACHINE
 *   The single fill that drawBottomLine and the strip clears all funnel through. drawBottomLine fills
 *   the lit byte 0x01 into all 0xe0 columns from PLAYFIELD_VRAM_BASE — a one-pixel ground line spanning
 *   the full screen width [seen]. clearScreenStrip is its zero-fill front door (it forces the value to
 *   zero and drops into this same loop). A pass count of zero would wrap to a full 256 passes (the
 *   8-bit `dcr b`; the loop tests after decrement). This is a head in its own right — `jmp 0x14cc` at
 *   0x01d6 enters with A pre-loaded, and loc_14cb falls in after zeroing A.
 *
 * ROM 0x14cc-0x14d7.  Grounding: [seen].
 * LIVE-OUT: HL = the destination pointer left one 0x20 stride past the final byte written.
 */
// Fill a run of rows with the byte, stepping one column right (+0x20) each pass -- a horizontal run; leave the pointer past the end.
export function fillScreenRow(m, value = m.regs.a, rows = m.regs.b, addr = m.regs.hl) {
  // One store per pass: write the byte, step 0x20 to the next 32-byte column, and count the pass down.
  // The 8-bit decrement (u8) and the post-test loop reproduce the 8080 `mov m,a` / `dad b` / `dcr b` /
  // `jnz` sequence, so a count of 0 runs a full 256 passes.
  do {
    m.mem8[addr] = value;
    addr = u16(addr + 0x20);
    rows = u8(rows - 1);
  } while (rows !== 0);
  // Return the pointer parked one stride past the last write, matching the ROM's live-out HL.
  return (m.regs.hl = addr);
}
