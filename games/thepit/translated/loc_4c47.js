// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_4c47  (ROM 0x4c47–0x4c4c, The Pit) — DISABLE sound: clears LS259 latch
 * bit 3 (sound enable) by writing 0x00 to 0xb003.
 *
 *   4c47  3e 00        ld   a,0x00
 *   4c49  32 03 b0     ld   (0xb003),a     ; LS259 b3 <- A&1 = 0  -> sound OFF
 *   4c4c  c9           ret
 *
 * WHAT IT DOES: A single LS259 addressable-latch write. On this hardware the
 * eight control bits each live at their own address 0xb000..0xb007 with the datum
 * on d0 (io.writeControlLatch(bit, value & 1)); bit 3 is the sound-enable line.
 * A = 0x00 has d0 = 0, so the write CLEARS bit 3 and silences the audio. It is the
 * mirror of loc_4c4d, which loads 0x01 into the same address to re-enable sound.
 *
 * The 0xb003 store is a HARDWARE write, so it carries busOffset 10 (`ld (nn),a`)
 * for the write trace; only bit 0 of A reaches the latch. No RAM, no flags read.
 */
export function loc_4c47(m) {
  const { regs, mem } = m;

  regs.a = 0x00; // 4c47  ld a,0x00
  m.step(0x4c49, 7);
  mem.write8(0xb003, regs.a, 10); // 4c49  ld (0xb003),a -- LS259 b3 <- A&1 (sound OFF)
  m.step(0x4c4c, 13);

  m.ret(); // 4c4c  ret
}
