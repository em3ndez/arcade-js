// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0348  (ROM 0x0348-0x0370, The Pit) -- the in-game main loop. Each pass it
 * re-establishes the stack, kicks the watchdog, runs the per-frame service
 * routines, burns a nested busy-delay whose length comes from (0x8011), and then
 * loops back to its own start forever -- it never executes a `ret`.
 *
 *   0348  31 ff 83     ld   sp,0x83ff     ; re-seat the stack at the top of work RAM
 *   034b  3a 00 b8     ld   a,(0xb800)    ; READ kicks the watchdog (value discarded)
 *   034e  cd 14 4b     call 0x4b14        ; per-frame service
 *   0351  3a 01 80     ld   a,(0x8001)    ; game-mode byte
 *   0354  fe 04        cp   0x04          ; Z <- (0x8001 == 4)
 *   0356  cc e8 03     call z,0x03e8      ; only when the mode byte is 4
 *   0359  cd c9 13     call 0x13c9        ; per-frame service
 *   035c  cd 1c 24     call 0x241c        ; per-frame service
 *   035f  cd ac 06     call 0x06ac        ; per-frame service
 *   0362  cd f3 24     call 0x24f3        ; per-frame service
 *   0365  3a 11 80     ld   a,(0x8011)    ; outer delay count
 *   0368  06 00        ld   b,0x00        ; inner delay count (0 -> 256 spins)
 * loc_036a:
 *   036a  10 fe        djnz 0x036a        ; inner busy spin (256 per pass)
 *   036c  3d           dec  a             ; sets Z when the outer count hits 0
 *   036d  20 fb        jr   nz,0x036a     ; another 256-spin pass while A != 0
 *   036f  18 d7        jr   0x0348        ; loop back to the top, forever
 *
 * MODELLING NOTES.
 *   - The `ld a,(0xb800)` READ is the watchdog kick (boards/thepit/io.js: reading
 *     0xB800 resets the watchdog; the write side of 0xB800 is the sound latch).
 *     Modelled as a plain mem.read8 -- the AddressSpace performs the side effect.
 *   - `call z,0x03e8` is the loop's one data-dependent branch: 0x03e8 runs only
 *     when (0x8001) == 4. Modelled as the ROM behaves -- taken pushes the return
 *     0x0359 and charges 17 T; not-taken charges 10 T and just advances PC.
 *   - The delay is a nested busy-count identical in shape to loc_01a4's: B (= 0)
 *     spins 256 times per pass (0->0xFF->..->0x00), and the outer `dec a / jr nz`
 *     repeats that pass (0x8011) times. `djnz` touches no flags; the outer `jr nz`
 *     reads `dec a`'s Z. A == 0 on entry wraps to 256 passes -- faithful to the ROM.
 *   - The closing `jr 0x0348` jumps to this routine's OWN first instruction, so the
 *     whole body repeats forever. Modelled as the outer `for (;;)` (the same shape
 *     as the DK mainLoop): the final `m.step(0x0348, 12)` re-charges the jr and the
 *     loop re-runs the body. This routine has NO `ret` -- it is the top of the live
 *     stack; the vblank NMI is what actually breaks in on it, not a return.
 *
 * Role is best-effort from the code; the addresses, flags, cycle costs and control
 * flow are exact, one JS statement per Z80 instruction.
 */
export function loc_0348(m) {
  const { regs, mem } = m;

  // 036f  jr 0x0348 loops the whole body back to the top forever.
  for (;;) {
    regs.sp = 0x83ff;
    m.step(0x034b, 10); // 0348  ld sp,0x83ff -- re-seat the stack each pass

    regs.a = mem.read8(0xb800); // 034b  ld a,(0xb800) -- the READ kicks the watchdog
    m.step(0x034e, 13);

    m.push16(0x0351);
    m.step(0x4b14, 17); // 034e  call 0x4b14
    m.call(0x4b14);

    regs.a = mem.read8(0x8001);
    m.step(0x0354, 13); // 0351  ld a,(0x8001) -- game-mode byte

    regs.cp(0x04);
    m.step(0x0356, 7); // 0354  cp 0x04 -- Z <- (0x8001 == 4)

    // 0356  call z,0x03e8 -- run 0x03e8 only when the mode byte is 4
    if (regs.fZ) {
      m.push16(0x0359);
      m.step(0x03e8, 17); // call z taken
      m.call(0x03e8);
    } else {
      m.step(0x0359, 10); // call z not taken
    }

    m.push16(0x035c);
    m.step(0x13c9, 17); // 0359  call 0x13c9
    m.call(0x13c9);

    m.push16(0x035f);
    m.step(0x241c, 17); // 035c  call 0x241c
    m.call(0x241c);

    m.push16(0x0362);
    m.step(0x06ac, 17); // 035f  call 0x06ac
    m.call(0x06ac);

    m.push16(0x0365);
    m.step(0x24f3, 17); // 0362  call 0x24f3
    m.call(0x24f3);

    regs.a = mem.read8(0x8011);
    m.step(0x0368, 13); // 0365  ld a,(0x8011) -- outer delay count

    regs.b = 0x00;
    m.step(0x036a, 7); // 0368  ld b,0x00 -- inner delay count (0 -> 256 spins)

    // loc_036a: nested busy-delay. Inner djnz spins B 256 times (0->0xFF->..->0)
    // per pass; the outer `dec a / jr nz` repeats that pass (0x8011) times.
    for (;;) {
      for (;;) {
        // 036a  djnz 0x036a -- decrement B (no flags), spin while non-zero
        if (regs.djnz() !== 0) {
          m.step(0x036a, 13); // djnz taken
        } else {
          m.step(0x036c, 8); // djnz not taken -> fall through to dec a
          break;
        }
      }

      regs.a = regs.dec8(regs.a); // 036c  dec a -- Z set when the outer count hits 0
      m.step(0x036d, 4);

      // 036d  jr nz,0x036a -- another 256-spin pass while A != 0
      if (regs.fNZ) {
        m.step(0x036a, 12); // jr nz taken
      } else {
        m.step(0x036f, 7); // jr nz not taken -> fall to the loop-back jr
        break;
      }
    }

    // 036f  jr 0x0348 -- unconditional loop-back to the top (never rets)
    m.step(0x0348, 12);
  }
}
