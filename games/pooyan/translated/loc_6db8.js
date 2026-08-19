// SPDX-License-Identifier: GPL-3.0-only

// loc_6db8  (ROM 0x6db8-0x6df8) -- level-intro phase 0. Runs the shared per-frame update (0x0fbc),
// picks a script-timer word from table 0x70f3 indexed by min(7, (0x8907)>>2) via 0x0c45, seats it at
// (0x8f4a), primes the (0x8f48) delay to 0x40 and advances the phase counter (0x8f51). Then, only
// when (0x8907)>>3 sets carry, it runs a 0x60-byte ANTI-TAMPER compare of the loc_0ac8 original
// against its clone at 0x6df9; any mismatch jumps to the loc_0b32 clone at 0x7071.
export function loc_6db8(m) {
  const { regs, mem } = m;

  m.push16(0x6dbb);
  m.step(0x0fbc, 17); // 6db8  call 0x0fbc
  m.call(0x0fbc);
  regs.a = mem.read8(0x8907);
  m.step(0x6dbe, 13); // 6dbb  ld a,(0x8907)
  regs.a = regs.srl(regs.a);
  m.step(0x6dc0, 8); // 6dbe  srl a
  regs.a = regs.srl(regs.a);
  m.step(0x6dc2, 8); // 6dc0  srl a
  regs.cp(0x07);
  m.step(0x6dc4, 7); // 6dc2  cp 0x07
  if (regs.fC) {
    m.step(0x6dc8, 12); // 6dc4  jr c,0x6dc8
  } else {
    m.step(0x6dc6, 7);
    regs.a = 0x07;
    m.step(0x6dc8, 7); // 6dc6  ld a,0x07 -- clamp index to 7
  }
  regs.and(0x07);
  m.step(0x6dca, 7); // 6dc8  and 0x07
  regs.hl = 0x70f3;
  m.step(0x6dcd, 10); // 6dca  ld hl,0x70f3
  m.push16(0x6dd0);
  m.step(0x0c45, 17); // 6dcd  call 0x0c45 -- DE := word table_0x70f3[A]
  m.call(0x0c45);
  mem.write16(0x8f4a, regs.de);
  m.step(0x6dd4, 20); // 6dd0  ld (0x8f4a),de
  regs.a = 0x40;
  m.step(0x6dd6, 7); // 6dd4  ld a,0x40
  mem.write8(0x8f48, regs.a);
  m.step(0x6dd9, 13); // 6dd6  ld (0x8f48),a
  regs.hl = 0x8f51;
  m.step(0x6ddc, 10); // 6dd9  ld hl,0x8f51
  regs.incMem8(mem, regs.hl);
  m.step(0x6ddd, 11); // 6ddc  inc (hl) -- advance phase counter
  regs.a = mem.read8(0x8907);
  m.step(0x6de0, 13); // 6ddd  ld a,(0x8907)
  regs.a = regs.srl(regs.a);
  m.step(0x6de2, 8); // 6de0  srl a
  regs.a = regs.srl(regs.a);
  m.step(0x6de4, 8); // 6de2  srl a
  regs.a = regs.srl(regs.a);
  m.step(0x6de6, 8); // 6de4  srl a
  if (regs.fNC) { m.ret(11); return; } // 6de6  ret nc
  m.step(0x6de7, 5);

  regs.hl = 0x0ac8;
  m.step(0x6dea, 10); // 6de7  ld hl,0x0ac8 -- original routine bytes
  regs.de = 0x6df9;
  m.step(0x6ded, 10); // 6dea  ld de,0x6df9 -- its clone
  regs.b = 0x60;
  m.step(0x6def, 7); // 6ded  ld b,0x60
  for (;;) {
    regs.a = mem.read8(regs.de);
    m.step(0x6df0, 7); // 6def  ld a,(de)
    regs.cp(mem.read8(regs.hl));
    m.step(0x6df1, 7); // 6df0  cp (hl)
    if (regs.fNZ) {
      m.step(0x7071, 10); // 6df1  jp nz,0x7071 -- tamper: run the loc_0b32 clone
      return m.call(0x7071);
    }
    m.step(0x6df4, 10);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x6df5, 6); // 6df4  inc hl
    regs.de = (regs.de + 1) & 0xffff;
    m.step(0x6df6, 6); // 6df5  inc de
    if (regs.djnz() !== 0) { m.step(0x6def, 13); continue; } // 6df6  djnz 0x6def
    m.step(0x6df8, 8);
    break;
  }
  m.ret(); // 6df8  ret
}
