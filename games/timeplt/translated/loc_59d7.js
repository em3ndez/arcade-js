// SPDX-License-Identifier: GPL-3.0-only

// loc_59d7  (ROM 0x59D7-0x5BD6, Time Pilot) -- DATA, not code: 256 16-bit entries,
// cosine-phased (T[0] max, T[0x40] zero).
export function loc_59d7(m) {
  throw new Error(
    "0x59D7 is a 256-entry table of 16-bit words (0x59D7-0x5BD6), not code, and it was " +
      "entered as a routine at cycle " + m.cycles + ". The only branch that reaches it " +
      "is loc_5866's `jp nz,0x59d7` at 0x589E, taken when the whole-ROM checksum does " +
      "not come to 0xAF -- so either the image does not match the dump this was derived " +
      "from, or a translated routine corrupted the checksum loop's running total.",
  );
}
