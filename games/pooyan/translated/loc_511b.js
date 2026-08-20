// SPDX-License-Identifier: GPL-3.0-only

// loc_511b  (ROM 0x511b-0x5145) -- per-frame update dispatcher gated on (0x8907) bit0.
//   bit0 set   -> run the three sub-updaters 0x54c5 / 0x5519 / 0x5564, then branch on (0x8f61):
//                 non-zero -> tail 0x1171 + ret; zero -> join the shared tail at loc_5135.
//   bit0 clear -> run 0x53b0, then fall into the shared tail at loc_5135.
// loc_5135 tail: call 0x5146, then if (0x8d6d) != 0 ret nz, else call 0x56e8 and ret.
// Every callee here is untranslated in this batch (boundary) -- emitted as m.call, flagged.
export function loc_511b(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8907);      m.step(0x511e, 13);
  regs.bit(0, regs.a);             m.step(0x5120, 8);
  if (regs.fZ) {
    m.step(0x5141, 12);            // jr z,0x5141 -- bit0 clear
    m.push16(0x5144);
    m.step(0x53b0, 17);            // 5141  call 0x53b0
    m.call(0x53b0);
    m.step(0x5135, 12);            // 5144  jr 0x5135
  } else {
    m.step(0x5122, 7);             // jr z not taken
    m.push16(0x5125);
    m.step(0x54c5, 17);            // 5122  call 0x54c5
    m.call(0x54c5);
    m.push16(0x5128);
    m.step(0x5519, 17);            // 5125  call 0x5519
    m.call(0x5519);
    m.push16(0x512b);
    m.step(0x5564, 17);            // 5128  call 0x5564
    m.call(0x5564);
    regs.a = mem.read8(0x8f61);    m.step(0x512e, 13);
    regs.and(regs.a);              m.step(0x512f, 4);
    if (regs.fZ) {
      m.step(0x5135, 12);          // jr z,0x5135 -- join the shared tail
    } else {
      m.step(0x5131, 7);           // jr z not taken
      m.push16(0x5134);
      m.step(0x1171, 17);          // 5131  call 0x1171
      m.call(0x1171);
      return m.ret(10);            // 5134  ret
    }
  }

  // loc_5135: shared tail
  m.push16(0x5138);
  m.step(0x5146, 17);              // 5135  call 0x5146
  m.call(0x5146);
  regs.a = mem.read8(0x8d6d);      m.step(0x513b, 13);
  regs.and(regs.a);                m.step(0x513c, 4);
  if (regs.fNZ) { return m.ret(11); } // 513c  ret nz
  m.step(0x513d, 5);
  m.push16(0x5140);
  m.step(0x56e8, 17);              // 513d  call 0x56e8
  m.call(0x56e8);
  return m.ret(10);                // 5140  ret
}
