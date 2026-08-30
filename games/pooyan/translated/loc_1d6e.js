// SPDX-License-Identifier: GPL-3.0-only

// loc_1d6e  (ROM 0x1d6e-0x1d9b, falls through 0x1d82 loc_1d82) -- ticks the countdown timer at
// 0x8f4a and branches on its value.
//   - value == 0x40 (the boundary): verify the ROM checksum (loc_79e9), enqueue a display command
//     with DE=0x0626 (rst 0x38 -> loc_0038), fire the 0x0f44 sound, then ret.
//   - value != 0x40 but still nonzero (`and a; ret nz`): timer still running -- ret, nothing to do.
//   - value == 0: timer expired -- clear (0x880a), write 0x02 to 0x8f50 and 0x40 to 0x8d07, then
//     if bit 1 of (0x8907) is clear set the flag (0x8f61)=1.
// The `dec (hl)` flags are immediately overwritten by the following `cp 0x40`, so only the memory
// side-effect of the decrement matters for control flow.
export function loc_1d6e(m) {
  const { regs, mem } = m;

  regs.hl = 0x8f4a;
  m.step(0x1d71, 10); // 1d6e  ld hl,0x8f4a
  regs.a = mem.read8(regs.hl);
  m.step(0x1d72, 7); // 1d71  ld a,(hl) -- A = pre-decrement timer value
  regs.decMem8(mem, 0x8f4a);
  m.step(0x1d73, 11); // 1d72  dec (hl) -- tick timer down (flags overwritten by cp)
  regs.cp(0x40);
  m.step(0x1d75, 7); // 1d73  cp 0x40

  if (regs.fNZ) {
    m.step(0x1d82, 12); // 1d75  jr nz,0x1d82 (taken) -- timer != 0x40
  } else {
    m.step(0x1d77, 7); // 1d75  jr nz not taken -- timer hit the 0x40 boundary
    m.push16(0x1d7a);
    m.step(0x79e9, 17); // 1d77  call 0x79e9 -- verify ROM checksum (pattern A: rets to 0x1d7a)
    m.call(0x79e9);

    regs.de = 0x0626;
    m.step(0x1d7d, 10); // 1d7a  ld de,0x0626
    m.push16(0x1d7e);
    m.step(0x0038, 11); // 1d7d  rst 0x38 -> loc_0038 enqueue (DE=0x0626, rets to 0x1d7e)
    m.call(0x0038);

    m.push16(0x1d81);
    m.step(0x0f44, 17); // 1d7e  call 0x0f44 -- sound cue (pattern A: rets to 0x1d81)
    m.call(0x0f44);

    m.ret(); // 1d81  ret
    return;
  }

  // loc_1d82 -- timer != 0x40
  regs.and(regs.a);
  m.step(0x1d83, 4); // 1d82  and a
  if (regs.fNZ) {
    m.ret(11); // 1d83  ret nz taken -- timer still running (nonzero), nothing to do
    return;
  }
  m.step(0x1d84, 5); // 1d83  ret nz not taken -- timer expired (A == 0)

  mem.write8(0x880a, regs.a); // A == 0
  m.step(0x1d87, 13); // 1d84  ld (0x880a),a
  regs.l = 0x50;
  m.step(0x1d89, 7); // 1d87  ld l,0x50 -- H stays 0x8f -> HL = 0x8f50
  mem.write8(regs.hl, 0x02);
  m.step(0x1d8b, 10); // 1d89  ld (hl),0x02
  regs.hl = 0x8d07;
  m.step(0x1d8e, 10); // 1d8b  ld hl,0x8d07
  mem.write8(regs.hl, 0x40);
  m.step(0x1d90, 10); // 1d8e  ld (hl),0x40
  regs.a = mem.read8(0x8907);
  m.step(0x1d93, 13); // 1d90  ld a,(0x8907)
  regs.bit(1, regs.a);
  m.step(0x1d95, 8); // 1d93  bit 1,a
  if (regs.fNZ) {
    m.ret(11); // 1d95  ret nz taken -- bit 1 set, skip the flag write
    return;
  }
  m.step(0x1d96, 5); // 1d95  ret nz not taken

  regs.a = 0x01;
  m.step(0x1d98, 7); // 1d96  ld a,0x01
  mem.write8(0x8f61, regs.a);
  m.step(0x1d9b, 13); // 1d98  ld (0x8f61),a
  m.ret(); // 1d9b  ret
}
