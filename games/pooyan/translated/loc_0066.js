// SPDX-License-Identifier: GPL-3.0-only

// loc_0066  (ROM 0x0066-0x0092) -- a bare tail-jump to 0x066d. The bytes at
// 0x0069-0x0091 are an unreached data/table region (never fetched as code:
// the boot trace goes 0x0066 -> 0x066d directly), so they are not translated.
export function loc_0066(m) {
  m.step(0x066d, 10); // jp 0x066d
  return m.call(0x066d);
}
