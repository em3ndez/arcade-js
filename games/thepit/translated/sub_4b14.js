// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_4b14  (ROM 0x4b14–0x4b19) — ENABLE the NMI: sets LS259 latch bit 0
 * (the NMI mask) by writing 0x01 to 0xb000.
 *
 *   4b14  3e 01        ld   a,0x01
 *
 *   4b16  32 00 b0     ld   (0xb000),a      ; loc_4b16
 *   4b19  c9           ret
 *
 * The LS259 addressable latch (0xb000..0xb007) takes one bit per address with the
 * datum on d0; 0xb000 is bit 0 = the NMI mask. Loading A with 0x01 and writing it
 * therefore SETS the mask (NMI enabled) — the same tail entry_0066 uses at 0x01a1
 * to re-enable the NMI. This is the "enable" entry of a two-door helper: sub_4b10
 * (`ld a,0x00`) falls into the SAME loc_4b16 tail to CLEAR the bit (NMI disabled).
 * Only sub_4b14 (a = 0x01) is translated here; it enters above the shared tail.
 *
 * `ld a,n`, `ld (nn),a` and `ret` touch no flags, so F is whatever the caller held.
 * The hardware write passes busOffset 10 (`ld (nn),a`) for the write trace.
 */
export function sub_4b14(m) {
  const { regs, mem } = m;

  regs.a = 0x01; // ld a,0x01 -- datum for LS259 b0 (NMI mask = 1)
  m.step(0x4b16, 7);

  // loc_4b16 (shared tail with sub_4b10) -- write the datum to LS259 b0.
  mem.write8(0xb000, regs.a, 10); // ld (0xb000),a -- set NMI mask (enable NMI)
  m.step(0x4b19, 13);

  m.ret(); // 4b19  ret
}
