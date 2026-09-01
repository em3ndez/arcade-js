// SPDX-License-Identifier: GPL-3.0-only
// loc_0aea  (ROM 0x0aea-0x0b88 + interior loc_0be8) -- per-round setup + pre-round wait loops, `jmp 0x0aea`
// from 0x18e4: silence sound (OUT 3/5), EI, draw the round screens, wait on the start trigger (0x20c0/0x2015), fall through into loc_0b89.
export function loc_0aea(m) {
  const { regs, mem } = m;

  regs.xor(regs.a); m.step(0x0aeb, 4); // 0aea  xra a
  m.io.portOut(0x03, regs.a); m.step(0x0aed, 10); // 0aeb  out 0x03
  m.io.portOut(0x05, regs.a); m.step(0x0aef, 10); // 0aed  out 0x05
  m.push16(0x0af2); m.step(0x1982, 17); m.call(0x1982); // 0aef  call 0x1982
  m.io.setInte(true); m.step(0x0af3, 4); // 0af2  ei
  m.push16(0x0af6); m.step(0x0ab1, 17); m.call(0x0ab1);
  regs.a = mem.read8(0x20ec); m.step(0x0af9, 13); // 0af6  lda 0x20ec
  regs.and(regs.a); m.step(0x0afa, 4); // 0af9  ana a
  regs.hl = 0x3017; m.step(0x0afd, 10); // 0afa  lxi h,0x3017
  regs.c = 0x04; m.step(0x0aff, 7); // 0afd  mvi c,0x04
  if (regs.fNZ) { // 0aff  jnz 0x0be8
    m.step(0x0be8, 10);
    regs.de = 0x1dab; m.step(0x0beb, 10); // 0be8  lxi d,0x1dab
    m.push16(0x0bee); m.step(0x0a93, 17); m.call(0x0a93);
    m.step(0x0b0b, 10); // 0bee  jmp 0x0b0b
  } else {
    m.step(0x0b02, 10);
    regs.de = 0x1cfa; m.step(0x0b05, 10); // 0b02  lxi d,0x1cfa
    m.push16(0x0b08); m.step(0x0a93, 17); m.call(0x0a93);
    regs.de = 0x1daf; m.step(0x0b0b, 10); // 0b08  lxi d,0x1daf
  }

  m.push16(0x0b0e); m.step(0x0acf, 17); m.call(0x0acf);
  m.push16(0x0b11); m.step(0x0ab1, 17); m.call(0x0ab1);
  m.push16(0x0b14); m.step(0x1815, 17); m.call(0x1815);
  m.push16(0x0b17); m.step(0x0ab6, 17); m.call(0x0ab6);
  regs.a = mem.read8(0x20ec); m.step(0x0b1a, 13); // 0b17  lda 0x20ec
  regs.and(regs.a); m.step(0x0b1b, 4); // 0b1a  ana a
  if (regs.fNZ) { // 0b1b  jnz 0x0b4a
    m.step(0x0b4a, 10);
  } else {
    m.step(0x0b1e, 10);
    regs.de = 0x1a95; m.step(0x0b21, 10); // 0b1e  lxi d,0x1a95
    m.push16(0x0b24); m.step(0x0ae2, 17); m.call(0x0ae2);
    m.push16(0x0b27); m.step(0x0a80, 17); m.call(0x0a80);
    regs.de = 0x1bb0; m.step(0x0b2a, 10); // 0b27  lxi d,0x1bb0
    m.push16(0x0b2d); m.step(0x0ae2, 17); m.call(0x0ae2);
    m.push16(0x0b30); m.step(0x0a80, 17); m.call(0x0a80);
    m.push16(0x0b33); m.step(0x0ab1, 17); m.call(0x0ab1);
    regs.de = 0x1fc9; m.step(0x0b36, 10); // 0b33  lxi d,0x1fc9
    m.push16(0x0b39); m.step(0x0ae2, 17); m.call(0x0ae2);
    m.push16(0x0b3c); m.step(0x0a80, 17); m.call(0x0a80);
    m.push16(0x0b3f); m.step(0x0ab1, 17); m.call(0x0ab1);
    regs.hl = 0x33b7; m.step(0x0b42, 10); // 0b3f  lxi h,0x33b7
    regs.b = 0x0a; m.step(0x0b44, 7); // 0b42  mvi b,0x0a
    m.push16(0x0b47); m.step(0x14cb, 17); m.call(0x14cb);
    m.push16(0x0b4a); m.step(0x0ab6, 17); m.call(0x0ab6);
  }

  m.push16(0x0b4d); m.step(0x09d6, 17); m.call(0x09d6); // 0b4a  call 0x09d6
  regs.a = mem.read8(0x21ff); m.step(0x0b50, 13); // 0b4d  lda 0x21ff
  regs.and(regs.a); m.step(0x0b51, 4); // 0b50  ana a
  if (regs.fNZ) { // 0b51  jnz 0x0b5d
    m.step(0x0b5d, 10);
  } else {
    m.step(0x0b54, 10);
    m.push16(0x0b57); m.step(0x08d1, 17); m.call(0x08d1);
    mem.write8(0x21ff, regs.a); m.step(0x0b5a, 13); // 0b57  sta 0x21ff
    m.push16(0x0b5d); m.step(0x1a7f, 17); m.call(0x1a7f);
  }

  m.push16(0x0b60); m.step(0x01e4, 17); m.call(0x01e4); // 0b5d  call 0x01e4
  m.push16(0x0b63); m.step(0x01c0, 17); m.call(0x01c0);
  m.push16(0x0b66); m.step(0x01ef, 17); m.call(0x01ef); // 0b63  call 0x01ef
  m.push16(0x0b69); m.step(0x021a, 17); m.call(0x021a); // 0b66  call 0x021a
  regs.a = 0x01; m.step(0x0b6b, 7); // 0b69  mvi a,0x01
  mem.write8(0x20c1, regs.a); m.step(0x0b6e, 13); // 0b6b  sta 0x20c1
  m.push16(0x0b71); m.step(0x01cf, 17); m.call(0x01cf); // 0b6e  call 0x01cf

  for (;;) { // loc_0b71: run the pre-round frame loop until the trigger is armed
    m.push16(0x0b74); m.step(0x1618, 17); m.call(0x1618); // 0b71  call 0x1618
    m.push16(0x0b77); m.step(0x0bf1, 17); m.call(0x0bf1); // 0b74  call 0x0bf1
    m.io.portOut(0x06, regs.a); m.step(0x0b79, 10); // 0b77  out 0x06
    m.push16(0x0b7c); m.step(0x0a59, 17); m.call(0x0a59); // 0b79  call 0x0a59
    if (regs.fZ) { m.step(0x0b71, 10); continue; } // 0b7c  jz 0x0b71
    m.step(0x0b7f, 10); break;
  }
  regs.xor(regs.a); m.step(0x0b80, 4); // 0b7f  xra a
  mem.write8(0x2025, regs.a); m.step(0x0b83, 13); // 0b80  sta 0x2025

  for (;;) { // loc_0b83: wait until the trigger clears again
    m.push16(0x0b86); m.step(0x0a59, 17); m.call(0x0a59); // 0b83  call 0x0a59
    if (regs.fNZ) { m.step(0x0b83, 10); continue; } // 0b86  jnz 0x0b83
    m.step(0x0b89, 10); break; // fall through into loc_0b89 (its own head)
  }
  return m.call(0x0b89); // fall-through delegate to loc_0b89
}
