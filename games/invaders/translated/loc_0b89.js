// SPDX-License-Identifier: GPL-3.0-only
// loc_0b89  (ROM 0x0b89-0x0be7) -- round teardown / next-round setup; second entry into the loc_0aea flow
// (fall-through from loc_0b83 and `jmp 0x0b89` from 0x16e3), so its own head. Exits via `jmp 0x18df` (tail to loc_18df).
export function loc_0b89(m) {
  const { regs, mem } = m;

  regs.xor(regs.a); m.step(0x0b8a, 4); // 0b89  xra a
  mem.write8(0x20c1, regs.a); m.step(0x0b8d, 13); // 0b8a  sta 0x20c1
  m.push16(0x0b90); m.step(0x0ab1, 17); m.call(0x0ab1); // 0b8d  call 0x0ab1
  m.push16(0x0b93); m.step(0x1988, 17); m.call(0x1988);
  regs.c = 0x0c; m.step(0x0b95, 7); // 0b93  mvi c,0x0c
  regs.hl = 0x2c11; m.step(0x0b98, 10); // 0b95  lxi h,0x2c11
  regs.de = 0x1f90; m.step(0x0b9b, 10); // 0b98  lxi d,0x1f90
  m.push16(0x0b9e); m.step(0x08f3, 17); m.call(0x08f3);
  regs.a = mem.read8(0x20ec); m.step(0x0ba1, 13); // 0b9e  lda 0x20ec
  regs.cp(0x00); m.step(0x0ba3, 7); // 0ba1  cpi 0x00
  if (regs.fNZ) { // 0ba3  jnz 0x0bae
    m.step(0x0bae, 10);
  } else {
    m.step(0x0ba6, 10);
    regs.hl = 0x3311; m.step(0x0ba9, 10); // 0ba6  lxi h,0x3311
    regs.a = 0x02; m.step(0x0bab, 7); // 0ba9  mvi a,0x02
    m.push16(0x0bae); m.step(0x08ff, 17); m.call(0x08ff);
  }

  regs.bc = 0x1f9c; m.step(0x0bb1, 10); // 0bae  lxi b,0x1f9c
  m.push16(0x0bb4); m.step(0x1856, 17); m.call(0x1856);
  m.push16(0x0bb7); m.step(0x184c, 17); m.call(0x184c);
  regs.a = m.io.portIn(0x02); m.step(0x0bb9, 10); // 0bb7  in 0x02
  regs.rlca(); m.step(0x0bba, 4); // 0bb9  rlc
  if (regs.fC) { // 0bba  jc 0x0bc3
    m.step(0x0bc3, 10);
  } else {
    m.step(0x0bbd, 10);
    regs.bc = 0x1fa0; m.step(0x0bc0, 10); // 0bbd  lxi b,0x1fa0
    m.push16(0x0bc3); m.step(0x183a, 17); m.call(0x183a); // 0bc0  call 0x183a
  }

  m.push16(0x0bc6); m.step(0x0ab6, 17); m.call(0x0ab6); // 0bc3  call 0x0ab6
  regs.a = mem.read8(0x20ec); m.step(0x0bc9, 13); // 0bc6  lda 0x20ec
  regs.cp(0x00); m.step(0x0bcb, 7); // 0bc9  cpi 0x00
  if (regs.fNZ) { // 0bcb  jnz 0x0bda
    m.step(0x0bda, 10);
  } else {
    m.step(0x0bce, 10);
    regs.de = 0x1fd5; m.step(0x0bd1, 10); // 0bce  lxi d,0x1fd5
    m.push16(0x0bd4); m.step(0x0ae2, 17); m.call(0x0ae2);
    m.push16(0x0bd7); m.step(0x0a80, 17); m.call(0x0a80);
    m.push16(0x0bda); m.step(0x189e, 17); m.call(0x189e); // 0bd7  call 0x189e
  }

  regs.hl = 0x20ec; m.step(0x0bdd, 10); // 0bda  lxi h,0x20ec
  regs.a = mem.read8(regs.hl); m.step(0x0bde, 7); // 0bdd  mov a,m
  regs.a = regs.inc8(regs.a); m.step(0x0bdf, 5); // 0bde  inr a
  regs.and(0x01); m.step(0x0be1, 7); // 0bdf  ani 0x01
  mem.write8(regs.hl, regs.a); m.step(0x0be2, 7); // 0be1  mov m,a
  m.push16(0x0be5); m.step(0x09d6, 17); m.call(0x09d6); // 0be2  call 0x09d6
  m.step(0x18df, 10); return m.call(0x18df); // 0be5  jmp 0x18df (tail)
}
