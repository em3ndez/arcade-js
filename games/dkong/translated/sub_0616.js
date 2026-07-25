// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_0616  (ROM 0x0616–0x0629) — draws string 5, sets up a one-byte BCD expansion at 0x6001, and tail-jumps to loop_0583.
 *
 *   0616  3e 05        ld   a,0x05
 *   0618  cd e9 05     call 0x05e9
 *   061b  21 01 60     ld   hl,0x6001
 *   061e  11 e0 ff     ld   de,0xffe0
 *   0621  dd 21 bf 74  ld   ix,0x74bf
 *   0625  06 01        ld   b,0x01
 *   0627  c3 83 05     jp   0x0583
 *
 * Draws string 5 via the shared string handler, then sets up a ONE-BYTE
 * BCD expansion at 0x6001 and TAIL JUMPS to 0x0583. The jump is not a call:
 * 0x0583's `ret` returns to *this* routine's caller, so sub_0616 has no
 * `ret` of its own. Translating the tail jump as a call would return here
 * and then fall off the end of the routine.
 *
 * DE = 0xFFE0 is -32: each successive digit is written one tilemap ROW back,
 * which is what "vertical" text means in the unrotated tilemap space.
 */
export function sub_0616(m) {
  const { regs } = m;

  regs.a = 0x05;
  m.step(0x0618, 7);
  m.push16(0x061b);
  m.step(0x05e9, 17);
  m.call(0x05e9);

  regs.hl = 0x6001;
  m.step(0x061e, 10);
  regs.de = 0xffe0;
  m.step(0x0621, 10);
  regs.ix = 0x74bf;
  m.step(0x0625, 14); // DD-prefixed ld ix,nn
  regs.b = 0x01;
  m.step(0x0627, 7);
  m.step(0x0583, 10); // jp -- a TAIL jump, no return address pushed
  m.call(0x0583);
}
