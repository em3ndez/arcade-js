// SPDX-License-Identifier: GPL-3.0-only

// loc_5ae4  (ROM 0x5ae4-0x5b05) -- master per-frame updater: invoke the eleven subsystem handlers
// in fixed ROM order, then ret. Every target is untranslated in this batch (boundary) -- each is
// emitted with the canonical CALL idiom and flagged.
export function loc_5ae4(m) {
  m.push16(0x5ae7);
  m.step(0x5e78, 17);              // 5ae4  call 0x5e78
  m.call(0x5e78);
  m.push16(0x5aea);
  m.step(0x5f6a, 17);              // 5ae7  call 0x5f6a
  m.call(0x5f6a);
  m.push16(0x5aed);
  m.step(0x602f, 17);              // 5aea  call 0x602f
  m.call(0x602f);
  m.push16(0x5af0);
  m.step(0x6368, 17);              // 5aed  call 0x6368
  m.call(0x6368);
  m.push16(0x5af3);
  m.step(0x5df7, 17);              // 5af0  call 0x5df7
  m.call(0x5df7);
  m.push16(0x5af6);
  m.step(0x5b06, 17);              // 5af3  call 0x5b06
  m.call(0x5b06);
  m.push16(0x5af9);
  m.step(0x5d4d, 17);              // 5af6  call 0x5d4d
  m.call(0x5d4d);
  m.push16(0x5afc);
  m.step(0x5b86, 17);              // 5af9  call 0x5b86
  m.call(0x5b86);
  m.push16(0x5aff);
  m.step(0x6404, 17);              // 5afc  call 0x6404
  m.call(0x6404);
  m.push16(0x5b02);
  m.step(0x5d0b, 17);              // 5aff  call 0x5d0b
  m.call(0x5d0b);
  m.push16(0x5b05);
  m.step(0x5b2c, 17);              // 5b02  call 0x5b2c
  m.call(0x5b2c);
  return m.ret(10);                // 5b05  ret
}
