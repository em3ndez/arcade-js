// SPDX-License-Identifier: GPL-3.0-only

// loc_53d4  (ROM 0x53D4-0x55D3, Time Pilot) -- DATA, not code: 64 records of 8 bytes,
// four (tile, attribute) pairs each.
export function loc_53d4(m) {
  throw new Error(
    "0x53D4 is a 512-byte table (0x53D4-0x55D3), not code, and it was entered as a " +
      "routine at cycle " + m.cycles + ". loc_5337 loads it as data: `ld hl,0x53d4` at " +
      "ROM 0x536A, then `add hl,bc` and four rounds of ld a,(hl)/inc hl/ld b,(hl)/inc hl. " +
      "The only other reference is `call nz,0x53d4` at 0x5283, whose guard sums ROM " +
      "0x27DE-0x28DD to 0xC5 and subtracts 0xC5, so it is never taken on a genuine image.",
  );
}
