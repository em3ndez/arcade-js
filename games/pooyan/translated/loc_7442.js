// SPDX-License-Identifier: GPL-3.0-only

const DISPATCH_TABLE_7448 = "0x7448 (attract/boot state, selector 0x8921 mask 3): 744e 7517 755d";

// loc_7442  (ROM 0x7442-0x7447) -- attract/self-test state dispatcher. Reads selector (0x8921),
// masks to 0..3, and rst 0x28 -> loc_0028 reads the inline word table at 0x7448
// (state 0: 0x744e init+ROM-signature check; state 1: 0x7517 HUD-checksum + advance; state 2:
// 0x755d per-frame gameplay driver) and jp (hl)'s to the handler. No return is pushed before the
// rst, so the selected handler ret's straight to loc_7442's own caller (tail dispatch).
export function loc_7442(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8921);
  m.step(0x7445, 13); // 7442  ld a,(0x8921)
  regs.and(0x03);
  m.step(0x7447, 7); // 7445  and 0x03

  m.push16(0x7448); // 7447  rst 0x28 pushes its return = inline table base
  m.step(0x0028, 11);
  m.call(0x0028, DISPATCH_TABLE_7448);
}
