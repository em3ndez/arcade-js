// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_4c4d  (ROM 0x4c4d–0x4c52, The Pit) — SET the LS259 sound-enable latch
 * (control bit 3) by writing A=0x01 to 0xB003. It is the enable half of a
 * two-entry pair sharing one datum address: loc_4c47 loads A=0x00 to the SAME
 * 0xB003 (CLEAR / mute); this one loads A=0x01 (SET / unmute).
 *
 *   4c4d  3e 01        ld   a,0x01       ; datum for LS259 b3 (sound enable = 1)
 *   4c4f  32 03 b0     ld   (0xb003),a   ; LS259 latch: bit 3 (sound enable) <- 1
 *   4c52  c9           ret
 *
 * Only bit 0 of the store reaches the latch (writeControlLatch takes value & 1);
 * address 0xB003 selects latch BIT 3, and with A=0x01 that SETS it — the
 * sound-enable line goes high. The 0xB003 store is a hardware write, so it
 * carries the `ld (nn),a` write-bus offset of 10 for the write trace.
 */
export function loc_4c4d(m) {
  const { regs, mem } = m;

  regs.a = 0x01; // ld a,0x01 -- datum for LS259 b3 (sound enable = 1)
  m.step(0x4c4f, 7);
  mem.write8(0xb003, regs.a, 10); // ld (0xb003),a -- enable sound (latch b3 <- 1)
  m.step(0x4c52, 13);

  m.ret(10); // ret (0x4c52)
}
