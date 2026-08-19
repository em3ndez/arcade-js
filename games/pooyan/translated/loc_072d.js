// SPDX-License-Identifier: GPL-3.0-only

// loc_072d  (ROM 0x072d-0x075c) -- fill B=0x20 tiles via loc_02ce, then bail unless it was the
// final fill: loc_02ce decrements its (0x8809) counter, so a non-zero result (NZ) returns early.
// Otherwise, only when the ROM self-test tally (0x8fff) == 0x10 does it finish setup -- else it
// jumps to the main loop (0x020f). Finish: (0x8806)=0 / (0x8805)=1, clear (0x880a), fill attribute
// columns from source 0x0779 (loc_075d), enqueue three display commands via rst 0x38 (loc_0038),
// and clear the attract selector (0x8e51).
export function loc_072d(m) {
  const { regs, mem } = m;

  regs.b = 0x20;
  m.step(0x072f, 7); // 072d  ld b,0x20
  m.push16(0x0732);
  m.step(0x02ce, 17); // 072f  call 0x02ce (pattern A: rets to 0x0732)
  m.call(0x02ce);

  if (regs.fNZ) {
    m.ret(11); // 0732  ret nz taken -- (0x8809) still counting, more fills pending
    return;
  }
  m.step(0x0733, 5); // 0732  ret nz not taken

  regs.a = mem.read8(0x8fff);
  m.step(0x0736, 13); // 0733  ld a,(0x8fff)
  regs.cp(0x10);
  m.step(0x0738, 7); // 0736  cp 0x10
  if (regs.fNZ) {
    m.step(0x020f, 10); // 0738  jp nz,0x020f -- self-test tally != 0x10 -> main loop
    return m.call(0x020f);
  }
  m.step(0x073b, 10); // 0738  jp nz not taken

  regs.hl = 0x8806;
  m.step(0x073e, 10); // 073b  ld hl,0x8806
  mem.write8(regs.hl, 0x00);
  m.step(0x0740, 10); // 073e  ld (hl),0x00
  regs.hl = (regs.hl - 1) & 0xffff;
  m.step(0x0741, 6); // 0740  dec hl -> 0x8805
  mem.write8(regs.hl, 0x01);
  m.step(0x0743, 10); // 0741  ld (hl),0x01
  regs.xor(regs.a);
  m.step(0x0744, 4); // 0743  xor a
  mem.write8(0x880a, regs.a);
  m.step(0x0747, 13); // 0744  ld (0x880a),a
  regs.bc = 0x0779;
  m.step(0x074a, 10); // 0747  ld bc,0x0779 -- attribute-column source pointer

  m.push16(0x074d);
  m.step(0x075d, 17); // 074a  call 0x075d (pattern A: rets to 0x074d)
  m.call(0x075d);

  regs.de = 0x0604;
  m.step(0x0750, 10); // 074d  ld de,0x0604
  m.push16(0x0751);
  m.step(0x0038, 11); // 0750  rst 0x38 -> loc_0038 enqueue (pattern A: rets to 0x0751)
  m.call(0x0038);

  regs.de = 0x0500;
  m.step(0x0754, 10); // 0751  ld de,0x0500
  m.push16(0x0755);
  m.step(0x0038, 11); // 0754  rst 0x38 -> loc_0038 (rets to 0x0755)
  m.call(0x0038);

  regs.e = 0x02;
  m.step(0x0757, 7); // 0755  ld e,0x02 -- D stays 0x05 -> DE=0x0502
  m.push16(0x0758);
  m.step(0x0038, 11); // 0757  rst 0x38 -> loc_0038 (rets to 0x0758)
  m.call(0x0038);

  regs.xor(regs.a);
  m.step(0x0759, 4); // 0758  xor a
  mem.write8(0x8e51, regs.a);
  m.step(0x075c, 13); // 0759  ld (0x8e51),a -- clear attract selector
  m.ret(); // 075c  ret
}
