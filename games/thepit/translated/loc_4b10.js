// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_4b10  (ROM 0x4b10–0x4b19, The Pit) — writes A=0x00 to the LS259 control
 * latch at 0xB000 (address 0xB000 = latch bit 0, the NMI mask), i.e. CLEARS the
 * NMI-mask bit. It is the A=0 entry of a two-entry pair sharing the tail at
 * loc_4b16: loc_4b14 loads A=0x01 (SET) and falls into the same store. loc_4b10
 * reaches the store via an UNCONDITIONAL `jr 0x4b16` that jumps OVER the
 * `ld a,0x01` at 0x4b14, so A stays 0x00 — landing on 0x4b14 instead would flip
 * the bit the other way.
 *
 *   4b10  3e 00        ld   a,0x00
 *   4b12  18 02        jr   0x4b16      ; unconditional -- skips ld a,0x01 @4b14
 *   4b16  32 00 b0     ld   (0xb000),a  ; LS259 latch: bit 0 (NMI mask) <- 0
 *   4b19  c9           ret
 *
 * Only bit 0 of the write reaches the latch (writeControlLatch takes value & 1);
 * with A=0x00 that clears the NMI mask.
 */
export function loc_4b10(m) {
  const { regs, mem } = m;

  regs.a = 0x00;
  m.step(0x4b12, 7); // ld a,0x00

  m.step(0x4b16, 12); // jr 0x4b16 -- unconditional, skips ld a,0x01 @4b14

  // loc_4b16 (shared with loc_4b14): store A to the LS259 control latch bit 0.
  mem.write8(0xb000, regs.a, 10); // ld (0xb000),a -- NMI mask <- 0
  m.step(0x4b19, 13);

  m.ret(10); // ret (0x4b19)
}
