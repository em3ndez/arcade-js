// SPDX-License-Identifier: GPL-3.0-only

// loc_287e  (ROM 0x286D-0x28BA) — dive-tail helpers folded into one unit. Externally-entered labels
// are separate exports (loc_27ea jumps/calls each): loc_286d (0x286D) seeds HL=0x1403 then jp loc_281b;
// loc_2873 (0x2873) is a bare ret; loc_2874 (0x2874) calls loc_287e then jp loc_27fe; loc_288c (0x288C)
// bumps (0x8150) via block_289c; loc_28b0 (0x28B0) steps the (0x8147) counter. loc_287e (0x287E) sets
// (0x8150)=1 via block_289c. block_289c seeds (0x8146)/(0x8147) from (0x819B)&0x0F.
export function loc_286d(m) {
  m.regs.hl = 0x1403;
  m.step(0x2870, 10);
  m.step(0x281b, 10); // jp 0x281b
  return m.call(0x281b);
}

export function loc_2873(m) {
  m.ret(10); // ret -- phase 2..4, no dive step
}

export function loc_2874(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8101);
  m.step(0x2877, 13);
  regs.and(regs.a);
  m.step(0x2878, 4);
  if (regs.fZ) {
    m.push16(0x287b);
    m.step(0x287e, 17); // call z,0x287e -- (0x8101)==0
    m.call(0x287e);
  } else {
    m.step(0x287b, 10);
  }
  m.step(0x27fe, 10); // jp 0x27fe
  return m.call(0x27fe);
}

export function loc_287e(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x814f);
  m.step(0x2881, 13);
  regs.and(regs.a);
  m.step(0x2882, 4);
  if (regs.fNZ) {
    m.ret(11); // ret nz -- (0x814f) already set
    return;
  }
  m.step(0x2883, 5);
  regs.a = 0x01;
  m.step(0x2885, 7);
  mem.write8(0x8150, regs.a);
  m.step(0x2888, 13); // (0x8150) = 1
  m.push16(0x288b);
  m.step(0x289c, 17); // call 0x289c
  block_289c(m);
  m.ret(10);
}

export function loc_288c(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x814f);
  m.step(0x288f, 13);
  regs.and(regs.a);
  m.step(0x2890, 4);
  if (regs.fNZ) {
    m.ret(11); // ret nz -- (0x814f) already set
    return;
  }
  m.step(0x2891, 5);
  regs.a = mem.read8(0x8150);
  m.step(0x2894, 13);
  regs.a = regs.inc8(regs.a);
  m.step(0x2895, 4);
  mem.write8(0x8150, regs.a);
  m.step(0x2898, 13); // (0x8150) += 1
  m.push16(0x289b);
  m.step(0x289c, 17); // call 0x289c
  block_289c(m);
  m.ret(10);
}

export function loc_28b0(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(regs.hl);
  m.step(0x28b1, 7); // A = (0x8147)
  regs.and(regs.a);
  m.step(0x28b2, 4);
  if (regs.fZ) {
    m.step(0x28b6, 12); // jr z,0x28b6 -- counter at 0
    return block_28b6();
  }
  m.step(0x28b4, 7);
  regs.decMem8(mem, regs.hl);
  m.step(0x28b5, 11); // dec (0x8147)
  m.ret(10);

  function block_28b6() {
    regs.a = mem.read8(0x8146);
    m.step(0x28b9, 13);
    mem.write8(regs.hl, regs.a);
    m.step(0x28ba, 7); // (0x8147) = (0x8146)
    m.ret(10);
  }
}

function block_289c(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x819b);
  m.step(0x289f, 13);
  regs.and(0x0f);
  m.step(0x28a1, 7); // A = (0x819b) & 0x0f
  regs.add(regs.a);
  m.step(0x28a2, 4);
  regs.add(regs.a);
  m.step(0x28a3, 4);
  regs.add(regs.a);
  m.step(0x28a4, 4); // A *= 8
  regs.hl = 0x8146;
  m.step(0x28a7, 10);
  mem.write8(regs.hl, regs.a);
  m.step(0x28a8, 7); // (0x8146) = A
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x28a9, 6);
  mem.write8(regs.hl, regs.a);
  m.step(0x28aa, 7); // (0x8147) = A
  regs.a = 0x01;
  m.step(0x28ac, 7);
  mem.write8(0x814f, regs.a);
  m.step(0x28af, 13); // (0x814f) = 1
  m.ret(10);
}
