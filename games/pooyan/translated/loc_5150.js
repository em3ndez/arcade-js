// SPDX-License-Identifier: GPL-3.0-only

// loc_5150  (ROM 0x5150-0x5199) -- advance the attract/board script once its guard (0x8d6d) is clear.
// Picks a script row via loc_0c45 (table 0x519a, index (0x8907)&0x0f), then scans that row (stride-2
// {threshold,value} records) for the first threshold >= the phase counter (0x8901); bails via ret c
// (phase < 7) or ret nc (past the last record). On a match it latches the new guard (0x8d6d) and the
// row's value byte, then resolves two data pointers through loc_0c45 (tables 0x5264 / 0x52b0) into the
// live-script slots at 0x8d71 / 0x8d6f and clears 0x8d7b / 0x8d7e.
export function loc_5150(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8d6d);   m.step(0x5153, 13);
  regs.and(regs.a);             m.step(0x5154, 4);
  if (regs.fNZ) { m.ret(11); return; } // 5154  ret nz -- script busy
  m.step(0x5155, 5);

  regs.hl = 0x519a;             m.step(0x5158, 10);
  regs.a = mem.read8(0x8907);   m.step(0x515b, 13);
  regs.and(0x0f);               m.step(0x515d, 7);
  m.push16(0x5160); m.step(0x0c45, 17); m.call(0x0c45); // 515d  call 0x0c45 -- DE = row pointer
  regs.exDeHl();                m.step(0x5161, 4);
  regs.a = mem.read8(0x8901);   m.step(0x5164, 13);
  regs.cp(0x07);                m.step(0x5166, 7);
  if (regs.fC) { m.ret(11); return; } // 5166  ret c -- phase below 7
  m.step(0x5167, 5);

  // 5167: scan the row for the first record whose threshold matches (jr z) the phase; a threshold the
  // phase does not reach (ret nc) ends the scan without a match.
  for (;;) {
    regs.cp(mem.read8(regs.hl));  m.step(0x5168, 7);
    if (regs.fZ) { m.step(0x516f, 12); break; } // 5168  jr z,0x516f -- match
    m.step(0x516a, 7);
    if (regs.fNC) { m.ret(11); return; } // 516a  ret nc -- past the last matching record
    m.step(0x516b, 5);
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x516c, 6);
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x516d, 6);
    m.step(0x5167, 12); // 516d  jr 0x5167
  }

  mem.write8(0x8d6d, regs.a);   m.step(0x5172, 13); // 516f  latch guard = matched threshold
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x5173, 6);
  regs.a = mem.read8(regs.hl);  m.step(0x5174, 7);
  regs.b = regs.a;              m.step(0x5175, 4);
  mem.write8(0x8d74, regs.a);   m.step(0x5178, 13);
  regs.hl = 0x5264;             m.step(0x517b, 10);
  m.push16(0x517e); m.step(0x0c45, 17); m.call(0x0c45); // 517b  call 0x0c45 -- DE = data pointer (table 0x5264)
  regs.a = mem.read8(regs.de);  m.step(0x517f, 7);
  mem.write8(0x8d73, regs.a);   m.step(0x5182, 13);
  regs.de = (regs.de + 1) & 0xffff; m.step(0x5183, 6);
  mem.write16(0x8d71, regs.de); m.step(0x5187, 20); // 5183  ld (0x8d71),de
  regs.a = regs.b;              m.step(0x5188, 4);
  regs.hl = 0x52b0;             m.step(0x518b, 10);
  m.push16(0x518e); m.step(0x0c45, 17); m.call(0x0c45); // 518b  call 0x0c45 -- DE = data pointer (table 0x52b0)
  mem.write16(0x8d6f, regs.de); m.step(0x5192, 20); // 518e  ld (0x8d6f),de
  regs.xor(regs.a);             m.step(0x5193, 4);
  mem.write8(0x8d7b, regs.a);   m.step(0x5196, 13);
  mem.write8(0x8d7e, regs.a);   m.step(0x5199, 13);
  m.ret(); // 5199  ret
}
