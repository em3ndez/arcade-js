// SPDX-License-Identifier: GPL-3.0-only

// loc_5a56 cluster (ROM 0x5a56-0x5a9b) -- the third per-frame score-drip step plus the
// shared accumulate tail that all three drips (0x5a06, 0x5a1f, 0x5a56) funnel into.
//   loc_5a56  0x5a56-0x5a89 : variant C -- 1 rrca, ring (0x882a), counter (0x8824),
//             coord pair (0x882b/0x882c); falls into loc_5a8a on a full wrap.
//   loc_5a8a  0x5a8a-0x5a8b : full-wrap entry -- seeds A=0x63, falls into loc_5a8c.
//   loc_5a8c  0x5a8c-0x5a96 : add A to the score byte (0x8802), clamp to 0x63.
//   loc_5a97  0x5a97-0x5a9b : queue display cmd 0x0701 (rst 0x38), ret.
// Interior labels 0x5a8a/0x5a8c/0x5a97 are entered by 0x5a06/0x5a1f too, so each is a
// registered entry, not inlined. Off the attract path -> verified vs ROM bytes + disasm.

export function loc_5a56(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8810);
  m.step(0x5a59, 13); // 5a56  ld a,(0x8810)
  regs.hl = 0x882a;
  m.step(0x5a5c, 10); // 5a59  ld hl,0x882a
  regs.rrca();
  m.step(0x5a5d, 4); // 5a5c  rrca
  mem.write8(regs.hl, regs.rl(mem.read8(regs.hl)));
  m.step(0x5a5f, 15); // 5a5d  rl (hl)
  regs.a = mem.read8(regs.hl);
  m.step(0x5a60, 7); // 5a5f  ld a,(hl)
  regs.and(0x07);
  m.step(0x5a62, 7); // 5a60  and 0x07
  regs.cp(0x01);
  m.step(0x5a64, 7); // 5a62  cp 0x01
  if (regs.fNZ) {
    m.ret(11); // 5a64  ret nz
    return;
  }
  m.step(0x5a65, 5);
  regs.exDeHl();
  m.step(0x5a66, 4); // 5a65  ex de,hl
  m.push16(0x5a69); m.step(0x0f09, 17); m.call(0x0f09); // 5a66  call 0x0f09
  regs.hl = 0x8824;
  m.step(0x5a6c, 10); // 5a69  ld hl,0x8824
  regs.incMem8(mem, regs.hl);
  m.step(0x5a6d, 11); // 5a6c  inc (hl)
  regs.exDeHl();
  m.step(0x5a6e, 4); // 5a6d  ex de,hl
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x5a6f, 6); // 5a6e  inc hl
  regs.a = mem.read8(regs.hl);
  m.step(0x5a70, 7); // 5a6f  ld a,(hl)
  regs.add(0x10);
  m.step(0x5a72, 7); // 5a70  add a,0x10
  mem.write8(regs.hl, regs.a);
  m.step(0x5a73, 7); // 5a72  ld (hl),a
  regs.b = regs.a;
  m.step(0x5a74, 4); // 5a73  ld b,a
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x5a75, 6); // 5a74  inc hl
  regs.a = mem.read8(regs.hl);
  m.step(0x5a76, 7); // 5a75  ld a,(hl)
  regs.sub(regs.b);
  m.step(0x5a77, 4); // 5a76  sub b
  if (regs.fNC) {
    m.ret(11); // 5a77  ret nc
    return;
  }
  m.step(0x5a78, 5);
  regs.a = mem.read8(regs.hl);
  m.step(0x5a79, 7); // 5a78  ld a,(hl)
  regs.c = regs.a;
  m.step(0x5a7a, 4); // 5a79  ld c,a
  regs.and(0xf0);
  m.step(0x5a7c, 7); // 5a7a  and 0xf0
  regs.add(0x10);
  m.step(0x5a7e, 7); // 5a7c  add a,0x10
  regs.hl = (regs.hl - 1) & 0xffff;
  m.step(0x5a7f, 6); // 5a7e  dec hl
  regs.neg();
  m.step(0x5a81, 8); // 5a7f  neg
  regs.add(mem.read8(regs.hl));
  m.step(0x5a82, 7); // 5a81  add a,(hl)
  mem.write8(regs.hl, regs.a);
  m.step(0x5a83, 7); // 5a82  ld (hl),a
  regs.a = regs.c;
  m.step(0x5a84, 4); // 5a83  ld a,c
  regs.and(0x0f);
  m.step(0x5a86, 7); // 5a84  and 0x0f
  regs.cp(0x0f);
  m.step(0x5a88, 7); // 5a86  cp 0x0f
  if (regs.fNZ) {
    m.step(0x5a8c, 12); // 5a88  jr nz,0x5a8c
    return m.call(0x5a8c);
  }
  m.step(0x5a8a, 7); // 5a88  jr nz not taken -> fall into 0x5a8a
  return m.call(0x5a8a);
}

// loc_5a8a  (ROM 0x5a8a-0x5a8b) -- full-wrap entry: A=0x63, then into the accumulate tail.
export function loc_5a8a(m) {
  const { regs } = m;

  regs.a = 0x63;
  m.step(0x5a8c, 7); // 5a8a  ld a,0x63
  return m.call(0x5a8c);
}

// loc_5a8c  (ROM 0x5a8c-0x5a96) -- add A to the score byte at (0x8802), clamp to 0x63.
export function loc_5a8c(m) {
  const { regs, mem } = m;

  regs.hl = 0x8802;
  m.step(0x5a8f, 10); // 5a8c  ld hl,0x8802
  regs.add(mem.read8(regs.hl));
  m.step(0x5a90, 7); // 5a8f  add a,(hl)
  mem.write8(regs.hl, regs.a);
  m.step(0x5a91, 7); // 5a90  ld (hl),a
  regs.cp(0x63);
  m.step(0x5a93, 7); // 5a91  cp 0x63
  if (regs.fC) {
    m.step(0x5a97, 12); // 5a93  jr c,0x5a97
    return m.call(0x5a97);
  }
  m.step(0x5a95, 7);
  mem.write8(regs.hl, 0x63);
  m.step(0x5a97, 10); // 5a95  ld (hl),0x63
  return m.call(0x5a97);
}

// loc_5a97  (ROM 0x5a97-0x5a9b) -- queue display command 0x0701 via rst 0x38, then ret.
export function loc_5a97(m) {
  const { regs } = m;

  regs.de = 0x0701;
  m.step(0x5a9a, 10); // 5a97  ld de,0x0701
  m.push16(0x5a9b); m.step(0x0038, 11); m.call(0x0038); // 5a9a  rst 0x38
  m.ret(); // 5a9b  ret
}
