// SPDX-License-Identifier: GPL-3.0-only

const DISPATCH_TABLE_15A8 = "0x15a8 (state handlers, index (0x880a)&0x1f)";

// loc_15a1  (ROM 0x15a1-0x15a7) -- rst 0x28 state dispatcher, also entered by fall-through from
// loc_159b. Push HL (the return the SELECTED handler ret's to), read state index (0x880a)&0x1f, then
// rst 0x28 -> loc_0028 reads the inline word table at 0x15a8 and jp (hl)'s to table[index]. The bytes
// at 0x15a8+ are that jump table (data), not code; loc_0028 pops the table base rst pushed.
export function loc_15a1(m) {
  const { regs, mem } = m;

  m.push16(regs.hl);
  m.step(0x15a2, 11); // 15a1  push hl -- handler return address

  regs.a = mem.read8(0x880a);
  m.step(0x15a5, 13); // 15a2  ld a,(0x880a)
  regs.and(0x1f);
  m.step(0x15a7, 7); // 15a5  and 0x1f -- state index 0..31

  m.push16(0x15a8); // 15a7  rst 0x28 pushes its return = table base 0x15a8
  m.step(0x0028, 11);
  m.call(0x0028, DISPATCH_TABLE_15A8);
}
