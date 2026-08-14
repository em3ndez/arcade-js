// SPDX-License-Identifier: GPL-3.0-only

// loc_2a6a  (ROM 0x2A6A-0x2AF2) — IX sprite-object arm, live once (0x83B7)>=3. Counts down (ix+0x0a);
// on expiry it reads three bytes via blit helper 0x0aee, walks the 0x8276 pair to place the object
// relative to the frog X (0x8014), writes its sprite (ix+0x00..0x09), and falls into the shared tail.
//
// loc_2ae6 (ROM 0x2AE6-0x2AF2) — SECOND entry / shared tail: raise the (0x8371) one-shot and queue sound
// 0x90 via rst 0x18. loc_2a6a falls in; loc_2af3 (another arm) calls it. Registered at 0x2ae6.
export function loc_2a6a(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x83b7);
  m.step(0x2a6d, 13); // ld a,(0x83b7)
  regs.cp(0x03);
  m.step(0x2a6f, 7);
  if (regs.fC) { m.ret(11); return; } // ret c -- not armed yet
  m.step(0x2a70, 5);
  regs.c = regs.a;
  m.step(0x2a71, 4);
  regs.decMem8(mem, (regs.ix + 0x0a) & 0xffff);
  m.step(0x2a74, 23); // dec (ix+0x0a) -- spawn timer
  if (regs.fNZ) { m.ret(11); return; } // ret nz -- timer live
  m.step(0x2a75, 5);
  regs.a = mem.read8((regs.ix + 0x06) & 0xffff);
  m.step(0x2a78, 19);
  regs.or(regs.a);
  m.step(0x2a79, 4);
  if (regs.fNZ) { m.ret(11); return; } // ret nz -- already active
  m.step(0x2a7a, 5);

  m.push16(0x2a7d);
  m.step(0x0aee, 17); // call 0x0aee
  m.call(0x0aee);
  regs.b = regs.a;
  m.step(0x2a7e, 4);
  regs.a = regs.c;
  m.step(0x2a7f, 4);
  regs.add(regs.a);
  m.step(0x2a80, 4);
  regs.add(regs.a);
  m.step(0x2a81, 4);
  regs.add(regs.a);
  m.step(0x2a82, 4); // A = 8*C
  regs.add(0x80);
  m.step(0x2a84, 7);
  regs.cp(regs.b);
  m.step(0x2a85, 4);
  if (regs.fC) { m.ret(11); return; } // ret c
  m.step(0x2a86, 5);

  m.push16(0x2a89);
  m.step(0x0aee, 17); // call 0x0aee
  m.call(0x0aee);
  regs.and(0x03);
  m.step(0x2a8b, 7);
  if (regs.fZ) { m.step(0x2aaa, 12); return block_2aaa(); } // jr z,0x2aaa
  m.step(0x2a8d, 7);
  regs.c = 0x40;
  m.step(0x2a8f, 7);
  regs.hl = 0x8276;
  m.step(0x2a92, 10);
  regs.a = mem.read8(regs.hl);
  m.step(0x2a93, 7); // ld a,(0x8276)
  regs.rrca();
  m.step(0x2a94, 4);
  regs.rrca();
  m.step(0x2a95, 4);
  regs.add(0x24);
  m.step(0x2a97, 7);
  regs.d = regs.a;
  m.step(0x2a98, 4);
  regs.l = regs.inc8(regs.l);
  m.step(0x2a99, 4);
  regs.l = regs.inc8(regs.l);
  m.step(0x2a9a, 4);
  regs.b = mem.read8(regs.hl);
  m.step(0x2a9b, 7); // ld b,(0x8278)
  regs.a = mem.read8(0x8014);
  m.step(0x2a9e, 13); // ld a,(0x8014) -- frog X
  regs.sub(0x10);
  m.step(0x2aa0, 7);
  if (regs.fC) { m.step(0x2aaa, 12); return block_2aaa(); } // jr c,0x2aaa
  m.step(0x2aa2, 7);
  return block_2aa2();

  function block_2aa2() {
    regs.sub(regs.c);
    m.step(0x2aa3, 4);
    if (regs.fC) { m.step(0x2abe, 12); return block_2abe(); } // jr c,0x2abe
    m.step(0x2aa5, 7);
    regs.sub(regs.d);
    m.step(0x2aa6, 4);
    if (regs.fC) { m.step(0x2aaa, 12); return block_2aaa(); } // jr c,0x2aaa
    m.step(0x2aa8, 7);
    if (regs.djnz() !== 0) { m.step(0x2aa2, 13); return block_2aa2(); } // djnz 0x2aa2
    m.step(0x2aaa, 8);
    return block_2aaa();
  }

  function block_2aaa() {
    mem.write8((regs.ix + 0x04) & 0xffff, 0x7e);
    m.step(0x2aae, 19); // ld (ix+0x04),0x7e -- sprite code
    m.push16(0x2ab1);
    m.step(0x0aee, 17); // call 0x0aee
    m.call(0x0aee);
    regs.rrca();
    m.step(0x2ab2, 4);
    if (regs.fC) { m.step(0x2ad2, 12); return block_2ad2(); } // jr c,0x2ad2
    m.step(0x2ab4, 7);
    mem.write8((regs.ix + 0x05) & 0xffff, 0x00);
    m.step(0x2ab8, 19);
    mem.write8((regs.ix + 0x03) & 0xffff, 0xf0);
    m.step(0x2abc, 19); // ld (ix+0x03),0xf0 -- park off-screen
    m.step(0x2ada, 12); // jr 0x2ada
    return block_2ada();
  }

  function block_2abe() {
    regs.add(regs.c);
    m.step(0x2abf, 4);
    regs.b = regs.a;
    m.step(0x2ac0, 4);
    regs.a = mem.read8(0x8014);
    m.step(0x2ac3, 13); // ld a,(0x8014)
    mem.write8((regs.ix + 0x02) & 0xffff, regs.a);
    m.step(0x2ac6, 19);
    regs.sub(regs.b);
    m.step(0x2ac7, 4);
    mem.write8((regs.ix + 0x01) & 0xffff, regs.a);
    m.step(0x2aca, 19);
    regs.add(regs.c);
    m.step(0x2acb, 4);
    mem.write8((regs.ix + 0x00) & 0xffff, regs.a);
    m.step(0x2ace, 19);
    mem.write8((regs.ix + 0x04) & 0xffff, 0x4e);
    m.step(0x2ad2, 19); // ld (ix+0x04),0x4e -- falls into block_2ad2
    return block_2ad2();
  }

  function block_2ad2() {
    mem.write8((regs.ix + 0x05) & 0xffff, 0x80);
    m.step(0x2ad6, 19);
    mem.write8((regs.ix + 0x03) & 0xffff, 0x00);
    m.step(0x2ada, 19); // ld (ix+0x03),0x00 -- falls into block_2ada
    return block_2ada();
  }

  function block_2ada() {
    mem.write8((regs.ix + 0x06) & 0xffff, 0x01);
    m.step(0x2ade, 19);
    mem.write8((regs.ix + 0x08) & 0xffff, 0x0b);
    m.step(0x2ae2, 19);
    mem.write8((regs.ix + 0x09) & 0xffff, 0x08);
    m.step(0x2ae6, 19); // ld (ix+0x09),0x08 -- falls into loc_2ae6 (registered boundary)
    return m.call(0x2ae6);
  }
}

export function loc_2ae6(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8371);
  m.step(0x2ae9, 13); // ld a,(0x8371) -- one-shot flag
  regs.or(regs.a);
  m.step(0x2aea, 4);
  if (regs.fNZ) { m.ret(11); return; } // ret nz -- already fired
  m.step(0x2aeb, 5);
  regs.a = regs.inc8(regs.a);
  m.step(0x2aec, 4);
  mem.write8(0x8371, regs.a);
  m.step(0x2aef, 13); // ld (0x8371),a -- latch it
  regs.a = 0x90;
  m.step(0x2af1, 7);
  m.push16(0x2af2);
  m.step(0x0018, 11); // rst 0x18 -- queue sound 0x90
  m.call(0x0018);
  m.ret(10);
}
