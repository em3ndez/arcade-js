// SPDX-License-Identifier: GPL-3.0-only

// loc_3176  (ROM 0x3176-0x31B3, Time Pilot) -- DATA, not code. The upper bound is where the
// next registered routine starts; the table may end earlier.
export function loc_3176(m) {
  throw new Error(
    "0x3176 is a data table, not code, and it was entered as a routine at cycle " +
      m.cycles + ". loc_30a5 loads it as data: `ld hl,0x3176` at ROM 0x30B6 followed by " +
      "`rst 0x18`, which adds A to HL. It is entered as CODE only through loc_315b's " +
      "`jp 0x3176`, reached from `jp nz,0x315b` at 0x30E9 and 0x30F5 -- and unlike the " +
      "ROM-checksum traps elsewhere in this layer those guards read WORK RAM (0xACC7 " +
      "against 0x3B, 0xACC8 against 0x05 and 0x10), so this arm is reachable on bad " +
      "runtime state rather than dead on a genuine image.",
  );
}
