// SPDX-License-Identifier: GPL-3.0-only

// loc_5a1f  (ROM 0x5a1f-0x5a55) -- per-frame score-drip step, variant B.
// Same shape as 0x5a06 but 2 rrca, ring byte (0x882d) and a two-byte position pair
// at (0x882e)/(0x882f): when the ring's low 3 bits hold 1 it bumps a counter (0x8826),
// advances the first coord by 0x10, and while that coord has not overtaken the second
// (`sub b` / `ret nc`) it wraps the second coord (neg / add) and joins the shared
// score tail -- at 0x5a8c (partial wrap) or 0x5a8a (full wrap, A=0x63). Caller 0x59fa.
// Off the attract path -> boundaries verified against the ROM bytes + disasm agreement.
export function loc_5a1f(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8810);
  m.step(0x5a22, 13); // 5a1f  ld a,(0x8810)
  regs.hl = 0x882d;
  m.step(0x5a25, 10); // 5a22  ld hl,0x882d
  regs.rrca();
  m.step(0x5a26, 4); // 5a25  rrca
  regs.rrca();
  m.step(0x5a27, 4); // 5a26  rrca
  mem.write8(regs.hl, regs.rl(mem.read8(regs.hl)));
  m.step(0x5a29, 15); // 5a27  rl (hl)
  regs.a = mem.read8(regs.hl);
  m.step(0x5a2a, 7); // 5a29  ld a,(hl)
  regs.and(0x07);
  m.step(0x5a2c, 7); // 5a2a  and 0x07
  regs.cp(0x01);
  m.step(0x5a2e, 7); // 5a2c  cp 0x01
  if (regs.fNZ) {
    m.ret(11); // 5a2e  ret nz
    return;
  }
  m.step(0x5a2f, 5);
  regs.exDeHl();
  m.step(0x5a30, 4); // 5a2f  ex de,hl
  m.push16(0x5a33); m.step(0x0f09, 17); m.call(0x0f09); // 5a30  call 0x0f09
  regs.hl = 0x8826;
  m.step(0x5a36, 10); // 5a33  ld hl,0x8826
  regs.incMem8(mem, regs.hl);
  m.step(0x5a37, 11); // 5a36  inc (hl)
  regs.exDeHl();
  m.step(0x5a38, 4); // 5a37  ex de,hl
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x5a39, 6); // 5a38  inc hl
  regs.a = mem.read8(regs.hl);
  m.step(0x5a3a, 7); // 5a39  ld a,(hl)
  regs.add(0x10);
  m.step(0x5a3c, 7); // 5a3a  add a,0x10
  mem.write8(regs.hl, regs.a);
  m.step(0x5a3d, 7); // 5a3c  ld (hl),a
  regs.b = regs.a;
  m.step(0x5a3e, 4); // 5a3d  ld b,a
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x5a3f, 6); // 5a3e  inc hl
  regs.a = mem.read8(regs.hl);
  m.step(0x5a40, 7); // 5a3f  ld a,(hl)
  regs.sub(regs.b);
  m.step(0x5a41, 4); // 5a40  sub b
  if (regs.fNC) {
    m.ret(11); // 5a41  ret nc
    return;
  }
  m.step(0x5a42, 5);
  regs.a = mem.read8(regs.hl);
  m.step(0x5a43, 7); // 5a42  ld a,(hl)
  regs.c = regs.a;
  m.step(0x5a44, 4); // 5a43  ld c,a
  regs.and(0xf0);
  m.step(0x5a46, 7); // 5a44  and 0xf0
  regs.add(0x10);
  m.step(0x5a48, 7); // 5a46  add a,0x10
  regs.hl = (regs.hl - 1) & 0xffff;
  m.step(0x5a49, 6); // 5a48  dec hl
  regs.neg();
  m.step(0x5a4b, 8); // 5a49  neg
  regs.add(mem.read8(regs.hl));
  m.step(0x5a4c, 7); // 5a4b  add a,(hl)
  mem.write8(regs.hl, regs.a);
  m.step(0x5a4d, 7); // 5a4c  ld (hl),a
  regs.a = regs.c;
  m.step(0x5a4e, 4); // 5a4d  ld a,c
  regs.and(0x0f);
  m.step(0x5a50, 7); // 5a4e  and 0x0f
  regs.cp(0x0f);
  m.step(0x5a52, 7); // 5a50  cp 0x0f
  if (regs.fNZ) {
    m.step(0x5a8c, 12); // 5a52  jr nz,0x5a8c
    return m.call(0x5a8c);
  }
  m.step(0x5a54, 7);
  m.step(0x5a8a, 12); // 5a54  jr 0x5a8a
  return m.call(0x5a8a);
}
