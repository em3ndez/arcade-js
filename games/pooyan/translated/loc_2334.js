// SPDX-License-Identifier: GPL-3.0-only
//
// loc_2334  (ROM 0x2334-0x2369) -- object state handler (IX-relative actor at 0x8a80), entered by
// `jp 0x2334` from 0x780b. Advances (ix+0x04) with a low clamp of 0x41, refreshes the derived sprite
// Y trio via loc_23d7, then scans a script pointer (0x88be) and a 7-byte block at 0x8901; when the
// scan finds work it drops into the shared phase-advance tail via loc_23ec + the 0x88bd counter,
// tail-jumping to loc_23ad. loc_23d7/loc_23ec are plain-ret (pattern A). Un-annotated m.step
// addresses = the previous step's nextAddr.
export function loc_2334(m) {
  const { regs, mem } = m;

  regs.b = regs.inc8(regs.b); m.step(0x2335, 4);
  regs.cp(0x41); m.step(0x2337, 7);
  if (regs.fNC) {
    m.step(0x233d, 12);
  } else {
    m.step(0x2339, 7);
    mem.write8((regs.ix + 0x04) & 0xffff, 0x41); m.step(0x233d, 19); // 2339  ld (ix+4),0x41 (clamp)
  }
  m.push16(0x2340); m.step(0x23d7, 17); m.call(0x23d7); // 233d  call 0x23d7 (pattern A)
  regs.hl = mem.read16(0x88be); m.step(0x2343, 16); // 2340  ld hl,(0x88be)
  regs.a = regs.l; m.step(0x2344, 4);
  regs.cp(0xe6); m.step(0x2346, 7);

  let go2359 = false;
  if (regs.fNZ) {
    m.step(0x2359, 12); go2359 = true;
  } else {
    m.step(0x2348, 7);
    regs.a = mem.read8(regs.hl); m.step(0x2349, 7); // 2348  ld a,(hl)
    regs.cp(0x35); m.step(0x234b, 7);
    if (regs.fNC) {
      m.step(0x2359, 12); go2359 = true;
    } else {
      m.step(0x234d, 7);
      regs.h = 0x89; m.step(0x234f, 7);
      regs.b = 0x07; m.step(0x2351, 7);
      for (;;) {
        regs.hl = (regs.hl + 1) & 0xffff; m.step(0x2352, 6);
        regs.a = mem.read8(regs.hl); m.step(0x2353, 7); // 2352  ld a,(hl)
        regs.or(regs.a); m.step(0x2354, 4);
        if (regs.fNZ) { m.step(0x2359, 12); go2359 = true; break; }
        m.step(0x2356, 7);
        if (regs.djnz() !== 0) { m.step(0x2351, 13); continue; }
        m.step(0x2358, 8); break;
      }
    }
  }
  if (!go2359) { m.ret(); return; } // 2358  ret (no work found)

  m.push16(0x235c); m.step(0x23ec, 17); m.call(0x23ec); // 2359  call 0x23ec (pattern A)
  regs.hl = 0x88bd; m.step(0x235f, 10);
  regs.incMem8(mem, regs.hl); m.step(0x2360, 11); // 235f  inc (hl)
  regs.a = mem.read8(regs.hl); m.step(0x2361, 7); // 2360  ld a,(hl)
  regs.and(0x07); m.step(0x2363, 7);
  mem.write8(regs.hl, regs.a); m.step(0x2364, 7); // 2363  ld (hl),a
  regs.and(regs.a); m.step(0x2365, 4);
  if (regs.fNZ) { m.ret(11); return; }
  m.step(0x2366, 5);
  regs.hl = (regs.hl - 1) & 0xffff; m.step(0x2367, 6);
  regs.incMem8(mem, regs.hl); m.step(0x2368, 11); // 2367  inc (hl)
  m.step(0x23ad, 12); return m.call(0x23ad); // 2368  jr 0x23ad (tail)
}
