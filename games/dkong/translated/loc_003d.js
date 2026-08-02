// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_003d  (ROM 0x0038–0x0043) — adds C to each of B bytes at HL, stride DE; the shared body reached at 0x003D and by fall-through from loc_0038.
 *
 *   0038  11 04 00     ld   de,0x0004     ; the `rst 0x38` entry
 *   003b  06 0a        ld   b,0x0a
 *   003d  79           ld   a,c           ; loc_003d, the SECOND entry
 *   003e  86           add  a,(hl)
 *   003f  77           ld   (hl),a
 *   0040  19           add  hl,de
 *   0041  10 fa        djnz 0x003d
 *   0043  c9           ret
 *
 * ONE ROUTINE WITH TWO ENTRY POINTS, and it must be taken as one. 0x003D is not
 * a separate routine; it is where 0x0038 falls through to, and where three
 * `call 0x003d` sites enter directly with their own DE and B.
 *
 * WHAT IT DOES: adds C to each of B bytes starting at HL, stride DE. Entered
 * via `rst 0x38` it is fixed at 10 bytes, stride 4; entered at 0x003D the
 * caller chooses both.
 *
 * THE FALL-THROUGH IS NOT A CALL. 0x003B runs into 0x003D with nothing
 * pushed, so the single `ret` at 0x0043 serves both entries -- via the rst it
 * pops the address the rst pushed, via a direct call it pops that call's. A
 * translation that made 0x0038 CALL 0x003D would unbalance the stack, which
 * is the defect this project just found in the rst 0x28 dispatcher: there the
 * push was modelled and the matching pop was not.
 *
 * `add a,(hl)` is 8-bit and WRAPS -- C = 0xFC at the 0x0D89 site is -4, so
 * this decrements. The carry it produces is overwritten each pass.
 *
 * `add hl,de` writes H, N and C (S/Z/PV preserved). The carry out of the
 * FINAL one survives `djnz` and `ret` and reaches the caller, so regs.addHl
 * is required rather than a bare 16-bit add -- the same shape as sub_11d3 and
 * as the defect already fixed at mainloop.js:878.
 *
 * B is not checked for zero. `djnz` decrements then tests, so B = 0 would run
 * 256 passes; the rst entry hardcodes 0x0A and no direct call site passes 0.
 */
export function loc_003d(m) {
  const { regs, mem } = m;

  do {
    // The whole body is the loop -- `djnz` targets 0x003D, this entry point.
    regs.a = regs.c;
    m.step(0x003e, 4); // ld a,c
    regs.add(mem.read8(regs.hl)); // 8-bit, wraps; C = 0xFC is -4
    m.step(0x003f, 7); // add a,(hl)
    mem.write8(regs.hl, regs.a);
    m.step(0x0040, 7); // ld (hl),a
    regs.addHl(regs.de); // writes H, N, C -- the final carry escapes
    m.step(0x0041, 11); // add hl,de
    regs.djnz();
    m.step(regs.b !== 0 ? 0x003d : 0x0043, regs.b !== 0 ? 13 : 8);
  } while (regs.b !== 0);

  m.ret(); // 0043 -- serves BOTH entry points
}
