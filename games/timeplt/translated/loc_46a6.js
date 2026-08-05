// SPDX-License-Identifier: GPL-3.0-only

// loc_46a6  (ROM 0x46A6-0x46B9, Time Pilot) -- real code, deliberately NOT transcribed:
// nothing in the ROM reaches it.
export function loc_46a6(m) {
  throw new Error(
    "0x46A6 was entered as a routine at cycle " + m.cycles + ", which no path in the ROM " +
      "does. A decode at every byte offset 0x0000-0x5FFF finds no call, jp, jr or djnz " +
      "targeting it, the byte pair a6 46 appears nowhere, and 0x46A3 is `jp 0x57f7` so " +
      "nothing falls in. The bytes decode cleanly and end `jp 0x467d`, and they sit inside " +
      "loc_43f0's declared range without being transcribed by it.",
  );
}
