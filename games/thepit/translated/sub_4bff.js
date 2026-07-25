// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_4bff  (ROM 0x4bff–0x4c10, The Pit) — arm a vblank delay of A frames, then
 * busy-wait for it. It stores A as a countdown at 0x8009, ENABLES the NMI
 * (LS259 b0 = 1 via 0xB000), then spins reading 0x8009 until the per-frame NMI
 * (entry_0066, which does `ld a,(0x8009); dec a; ld (0x8009),a`) has ticked it
 * down to 0 — kicking the watchdog on every spin (the read of 0xB800) so the long
 * wait does not trip a reset. Returns once 0x8009 reaches 0 (A = 0 waits 0 frames
 * and falls straight through).
 *
 *   4bff  32 09 80     ld   (0x8009),a      ; countdown <- A (frames to wait)
 *   4c02  3e 01        ld   a,0x01
 *   4c04  32 00 b0     ld   (0xb000),a      ; LS259 b0 = 1 -> enable the NMI
 *
 * loc_4c07:
 *   4c07  3a 00 b8     ld   a,(0xb800)      ; read watchdog = KICK it (A discarded)
 *   4c0a  3a 09 80     ld   a,(0x8009)      ; reload the countdown (NMI decrements it)
 *   4c0d  a7           and  a               ; Z = (countdown == 0)
 *   4c0e  20 f7        jr   nz,0x4c07       ; spin while non-zero
 *   4c10  c9           ret
 *
 * The loop mutates nothing itself — 0x8009 is driven to 0 by the NMI interposed at
 * m.step boundaries in a live run — so as a standalone oracle the loop terminates
 * exactly when the memory it reads reaches 0. `ld a,(0xb800)` is loaded only for its
 * SIDE EFFECT (io.readWatchdog kicks the watchdog); its value is overwritten by the
 * next `ld a,(0x8009)`. `and a` is the test-A-for-zero idiom (A & A = A; sets Z),
 * routed through regs.and so S/Z/PV/H/N/C match the hardware. Only bit 0 of the
 * 0xB000 write reaches the LS259 (writeControlLatch takes value & 1); with A=0x01
 * that SETS the NMI mask. The 0xB000 write carries busOffset 10 (`ld (nn),a`) for the
 * write trace; 0x8009 is work RAM and needs none.
 */
export function sub_4bff(m) {
  const { regs, mem } = m;

  mem.write8(0x8009, regs.a); // ld (0x8009),a -- frame countdown <- A
  m.step(0x4c02, 13);
  regs.a = 0x01; // ld a,0x01 -- datum for LS259 b0 (NMI mask = 1)
  m.step(0x4c04, 7);
  mem.write8(0xb000, regs.a, 10); // ld (0xb000),a -- enable the NMI
  m.step(0x4c07, 13);

  do {
    // loc_4c07 -- jr nz targets here.
    regs.a = mem.read8(0xb800); // ld a,(0xb800) -- KICK the watchdog (value discarded)
    m.step(0x4c0a, 13);
    regs.a = mem.read8(0x8009); // ld a,(0x8009) -- reload the countdown
    m.step(0x4c0d, 13);
    regs.and(regs.a); // and a -- Z = (A == 0)
    m.step(0x4c0e, 4);
    m.step(regs.fNZ ? 0x4c07 : 0x4c10, regs.fNZ ? 12 : 7); // jr nz,0x4c07
  } while (regs.fNZ);

  m.ret(); // 4c10  ret
}
