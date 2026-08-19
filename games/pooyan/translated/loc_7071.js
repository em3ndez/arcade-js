// SPDX-License-Identifier: GPL-3.0-only

// loc_7071  (ROM 0x7071-0x70e9) -- ANTI-TAMPER CLONE of loc_0b32 (attract sub-state-6 handler):
// a byte-for-byte duplicate reached by `jp nz,0x7071` at 0x6df1 (the state-0 handler's guard, which
// mismatches when the loc_0ac8 copy at 0x6df9 has been patched). The clone is a verbatim byte-for-byte
// copy of loc_0b32 (absolute operands unchanged, so no local address is relocated; only the entry
// address differs). The absolute targets (0x08b3/0x08e9/0x0a28/0x09f8/0x0c45/0x0e00) and the
// 0x0bab data-table pointer are unchanged. Verifies the (0x82bc) row block, runs the 0x8d41/0x8e50
// timers, seats the next script pointer from table 0x0bab, and column-checksums vs (0x8f48).

export function loc_7071(m) {
  const { regs, mem } = m;

  regs.hl = 0x82bc;
  m.step(0x7074, 10); // 7071  ld hl,0x82bc
  regs.de = 0xffe0;
  m.step(0x7077, 10); // 7074  ld de,0xffe0
  regs.b = 0x0a;
  m.step(0x7079, 7); // 7077  ld b,0x0a
  for (;;) {
    regs.a = mem.read8(regs.hl);
    m.step(0x707a, 7); // 7079  ld a,(hl)
    regs.addHl(regs.de);
    m.step(0x707b, 11); // 707a  add hl,de
    regs.cp(mem.read8(regs.hl));
    m.step(0x707c, 7); // 707b  cp (hl)
    if (regs.fNZ) {
      m.step(0x08b3, 10); // 707c  jp nz,0x08b3 -- row mismatch, re-enter sub-state 0
      return m.call(0x08b3);
    }
    m.step(0x707f, 10); // 707c  jp nz not taken -> djnz
    if (regs.djnz() !== 0) { m.step(0x7079, 13); continue; } // 707f  djnz 0x7079
    m.step(0x7081, 8);
    break;
  }

  regs.hl = 0x8d41;
  m.step(0x7084, 10); // 7081  ld hl,0x8d41
  regs.decMem8(mem, regs.hl);
  m.step(0x7085, 11); // 7084  dec (hl)
  if (regs.fNZ) {
    m.step(0x708a, 12); // 7085  jr nz,0x708a
  } else {
    m.step(0x7087, 7);
    m.push16(0x708a);
    m.step(0x0a28, 17); // 7087  call 0x0a28
    m.call(0x0a28);
  }
  m.push16(0x708d);
  m.step(0x09f8, 17); // 708a  call 0x09f8
  m.call(0x09f8);

  regs.hl = 0x8e50;
  m.step(0x7090, 10); // 708d  ld hl,0x8e50
  regs.decMem8(mem, regs.hl);
  m.step(0x7091, 11); // 7090  dec (hl)
  if (regs.fNZ) { m.ret(11); return; } // 7091  ret nz
  m.step(0x7092, 5);

  mem.write8(regs.hl, 0x01);
  m.step(0x7094, 10); // 7092  ld (hl),0x01
  regs.l = regs.inc8(regs.l);
  m.step(0x7095, 4); // 7094  inc l
  regs.decMem8(mem, regs.hl);
  m.step(0x7096, 11); // 7095  dec (hl)
  regs.a = mem.read8(0x8e53);
  m.step(0x7099, 13); // 7096  ld a,(0x8e53)
  regs.a = regs.dec8(regs.a);
  m.step(0x709a, 4); // 7099  dec a
  regs.hl = 0x0bab;
  m.step(0x709d, 10); // 709a  ld hl,0x0bab
  m.push16(0x70a0);
  m.step(0x0c45, 17); // 709d  call 0x0c45 -- DE = table[A]
  m.call(0x0c45);
  mem.write16(0x8e56, regs.de);
  m.step(0x70a4, 20); // 70a0  ld (0x8e56),de
  regs.hl = 0x8e53;
  m.step(0x70a7, 10); // 70a4  ld hl,0x8e53
  regs.decMem8(mem, regs.hl);
  m.step(0x70a8, 11); // 70a7  dec (hl)
  if (regs.fNZ) { m.ret(11); return; } // 70a8  ret nz
  m.step(0x70a9, 5);

  regs.hl = 0x8e50;
  m.step(0x70ac, 10); // 70a9  ld hl,0x8e50
  mem.write8(regs.hl, 0x96);
  m.step(0x70ae, 10); // 70ac  ld (hl),0x96
  regs.l = regs.inc8(regs.l);
  m.step(0x70af, 4); // 70ae  inc l
  regs.xor(regs.a);
  m.step(0x70b0, 4); // 70af  xor a
  mem.write8(regs.hl, regs.a);
  m.step(0x70b1, 7); // 70b0  ld (hl),a
  regs.hl = 0x8462;
  m.step(0x70b4, 10); // 70b1  ld hl,0x8462
  regs.d = regs.a;
  m.step(0x70b5, 4); // 70b4  ld d,a
  regs.e = regs.a;
  m.step(0x70b6, 4); // 70b5  ld e,a
  regs.c = 0x0e;
  m.step(0x70b8, 7); // 70b6  ld c,0x0e

  for (;;) { // outer column loop (0b79)
    regs.b = 0x1d;
    m.step(0x70ba, 7); // 70b8  ld b,0x1d
    for (;;) { // inner row-sum loop (0b7b)
      regs.a = regs.e;
      m.step(0x70bb, 4); // 70ba  ld a,e
      regs.add(mem.read8(regs.hl));
      m.step(0x70bc, 7); // 70bb  add a,(hl)
      if (regs.fNC) {
        m.step(0x70bf, 12); // 70bc  jr nc,0x70bf
      } else {
        m.step(0x70be, 7);
        regs.d = regs.inc8(regs.d);
        m.step(0x70bf, 4); // 70be  inc d
      }
      regs.e = regs.a;
      m.step(0x70c0, 4); // 70bf  ld e,a
      regs.hl = (regs.hl + 1) & 0xffff;
      m.step(0x70c1, 6); // 70c0  inc hl
      if (regs.djnz() !== 0) { m.step(0x70ba, 13); continue; } // 70c1  djnz 0x70ba
      m.step(0x70c3, 8);
      break;
    }
    regs.a = regs.l;
    m.step(0x70c4, 4); // 70c3  ld a,l
    regs.add(0x03);
    m.step(0x70c6, 7); // 70c4  add a,0x03
    regs.l = regs.a;
    m.step(0x70c7, 4); // 70c6  ld l,a
    if (regs.fNC) {
      m.step(0x70ca, 12); // 70c7  jr nc,0x70ca
    } else {
      m.step(0x70c9, 7);
      regs.h = regs.inc8(regs.h);
      m.step(0x70ca, 4); // 70c9  inc h
    }
    regs.c = regs.dec8(regs.c);
    m.step(0x70cb, 4); // 70ca  dec c
    if (regs.fNZ) { m.step(0x70b8, 12); continue; } // 70cb  jr nz,0x70b8
    m.step(0x70cd, 7);
    break;
  }

  regs.hl = mem.read16(0x8f48);
  m.step(0x70d0, 16); // 70cd  ld hl,(0x8f48)
  regs.a = regs.e;
  m.step(0x70d1, 4); // 70d0  ld a,e
  regs.cp(mem.read8(regs.hl));
  m.step(0x70d2, 7); // 70d1  cp (hl)
  if (regs.fNZ) {
    m.step(0x08b3, 10); // 70d2  jp nz,0x08b3
    return m.call(0x08b3);
  }
  m.step(0x70d5, 10);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x70d6, 6); // 70d5  inc hl
  regs.a = mem.read8(regs.hl);
  m.step(0x70d7, 7); // 70d6  ld a,(hl)
  regs.cp(regs.d);
  m.step(0x70d8, 4); // 70d7  cp d
  if (regs.fNZ) {
    m.step(0x08e9, 10); // 70d8  jp nz,0x08e9
    return m.call(0x08e9);
  }
  m.step(0x70db, 10);
  regs.xor(regs.a);
  m.step(0x70dc, 4); // 70db  xor a
  mem.write8(0x8f48, regs.a);
  m.step(0x70df, 13); // 70dc  ld (0x8f48),a
  mem.write8(0x8f49, regs.a);
  m.step(0x70e2, 13); // 70df  ld (0x8f49),a
  regs.a = 0x03;
  m.step(0x70e4, 7); // 70e2  ld a,0x03
  mem.write8(0x8805, regs.a);
  m.step(0x70e7, 13); // 70e4  ld (0x8805),a
  m.step(0x0e00, 10); // 70e7  jp 0x0e00 -- advance to the next screen builder
  return m.call(0x0e00);
}
