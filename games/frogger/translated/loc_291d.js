// SPDX-License-Identifier: GPL-3.0-only

// loc_291d  (ROM 0x291D-0x2968) — score/lane-animation helper. When (0x8101)==0 it clears the anim
// phase (0x833F)=0; otherwise, gated by (0x8150) bit0 and (0x814F)==0, it bumps (0x833F) and at phase
// 0x40 / 0x70 blits the two 2-tile figures at 0xA846/0xA866 (frames 0x68.. or 0xD0.., the latter also
// resetting the phase).
export function loc_291d(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8101);
  m.step(0x2920, 13);
  regs.and(regs.a);
  m.step(0x2921, 4);
  if (regs.fNZ) {
    m.step(0x2928, 12); // jr nz -- (0x8101) active
    return block_2928();
  }
  m.step(0x2923, 7);
  regs.xor(regs.a);
  m.step(0x2924, 4);
  mem.write8(0x833f, regs.a);
  m.step(0x2927, 13); // (0x833f) = 0 -- idle
  m.ret();
  return;

  function block_2928() {
    regs.a = mem.read8(0x8150);
    m.step(0x292b, 13);
    regs.bit(0, regs.a);
    m.step(0x292d, 8);
    if (regs.fZ) {
      m.ret(11); // ret z -- (0x8150) bit0 clear
      return;
    }
    m.step(0x292e, 5);
    regs.a = mem.read8(0x814f);
    m.step(0x2931, 13);
    regs.and(regs.a);
    m.step(0x2932, 4);
    if (regs.fNZ) {
      m.ret(11); // ret nz -- (0x814f) busy
      return;
    }
    m.step(0x2933, 5);
    regs.hl = 0x833f;
    m.step(0x2936, 10);
    regs.incMem8(mem, regs.hl);
    m.step(0x2937, 11); // inc (hl) -- advance the phase
    regs.a = mem.read8(regs.hl);
    m.step(0x2938, 7);
    regs.cp(0x40);
    m.step(0x293a, 7);
    if (regs.fZ) {
      m.step(0x2941, 12); // jr z -- phase 0x40
      return block_2941();
    }
    m.step(0x293c, 7);
    regs.cp(0x70);
    m.step(0x293e, 7);
    if (regs.fZ) {
      m.step(0x2953, 12); // jr z -- phase 0x70
      return block_2953();
    }
    m.step(0x2940, 7);
    m.ret();
  }

  function block_2941() {
    regs.hl = 0xa846;
    m.step(0x2944, 10);
    mem.write8(regs.hl, 0x68);
    m.step(0x2946, 10);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x2947, 6);
    mem.write8(regs.hl, 0x69);
    m.step(0x2949, 10);
    regs.bc = 0x001f;
    m.step(0x294c, 10);
    regs.addHl(regs.bc);
    m.step(0x294d, 11); // HL = 0xa866 -- second tile pair
    mem.write8(regs.hl, 0x6a);
    m.step(0x294f, 10);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x2950, 6);
    mem.write8(regs.hl, 0x6b);
    m.step(0x2952, 10);
    m.ret();
  }

  function block_2953() {
    regs.hl = 0xa846;
    m.step(0x2956, 10);
    mem.write8(regs.hl, 0xd0);
    m.step(0x2958, 10);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x2959, 6);
    mem.write8(regs.hl, 0xd1);
    m.step(0x295b, 10);
    regs.bc = 0x001f;
    m.step(0x295e, 10);
    regs.addHl(regs.bc);
    m.step(0x295f, 11); // HL = 0xa866
    mem.write8(regs.hl, 0xd2);
    m.step(0x2961, 10);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x2962, 6);
    mem.write8(regs.hl, 0xd3);
    m.step(0x2964, 10);
    regs.xor(regs.a);
    m.step(0x2965, 4);
    mem.write8(0x833f, regs.a);
    m.step(0x2968, 13); // (0x833f) = 0 -- restart the cycle
    m.ret();
  }
}
