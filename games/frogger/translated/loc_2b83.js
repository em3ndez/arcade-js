// SPDX-License-Identifier: GPL-3.0-only

// loc_2b83  (ROM 0x2B83-0x2B92) — IX sprite dispatcher B: calls the five sprite-object arms in
// fixed sequence (0x2c13, 0x2bab, 0x2b93, 0x2ca8, 0x2bfb), then returns.
export function loc_2b83(m) {
  m.push16(0x2b86);
  m.step(0x2c13, 17);
  m.call(0x2c13);
  m.push16(0x2b89);
  m.step(0x2bab, 17);
  m.call(0x2bab);
  m.push16(0x2b8c);
  m.step(0x2b93, 17);
  m.call(0x2b93);
  m.push16(0x2b8f);
  m.step(0x2ca8, 17);
  m.call(0x2ca8);
  m.push16(0x2b92);
  m.step(0x2bfb, 17);
  m.call(0x2bfb);
  m.ret();
}
