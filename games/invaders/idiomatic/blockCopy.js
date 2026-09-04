// SPDX-License-Identifier: GPL-3.0-only

/**
 * blockCopy (ROM 0x1a32) -- the machine's general byte mover.
 *
 * WHAT IT IS
 *   Copies B bytes from the source pointer (DE) to the destination (HL), both walking forward together.
 *   This is the 8080 `ldax d / mov m,a / inx d / inx h / dcr b / jnz` copy loop, unrolled into a JS
 *   for-loop. It is not specific to video memory.
 *
 * ROLE IN THE MACHINE
 *   The workhorse behind nearly every bulk move in the game: work-RAM seeding from the ROM template
 *   (initWorkRam), object move-record staging (copyRecordToWorkBuffer / copyWorkBufferToRecord), ROM
 *   template stamps into object records (copyTemplateToRecord), the draw-sequence loader
 *   (loadDrawSequenceBlock), shield-buffer setup, and the attract-anim descriptor copy. Callers seat DE
 *   (source), HL (destination), and B (count) and let this loop do the move.
 *
 * ROM 0x1a32.  Grounding: [seen] (names.js cert for 0x1a32).
 *
 * LIVE-OUT: memory only. The 8080 routine returns with HL/DE advanced past the block and B drained to 0,
 *   but no caller in this game reads those, so the idiomatic form writes only memory; the seam completes
 *   the ret.
 */
// Copy B bytes from source to destination, both pointers advancing. Live-out: memory only; the seam completes the ret.
export function blockCopy(m, de = m.regs.de, hl = m.regs.hl, b = m.regs.b) {
  // 8080 quirk: a count byte of 0 means a FULL 256-byte pass (the `dcr b / jnz` loop tests after the
  // first copy, so it wraps 0x00 -> 0xff and runs 256 times), not a zero-length copy.
  const n = b === 0 ? 256 : b;
  // Straight forward copy: destination (HL) receives source (DE) byte-for-byte, both indices climbing.
  for (let i = 0; i < n; i++) {
    m.mem8[hl + i] = m.mem8[de + i];
  }
}
