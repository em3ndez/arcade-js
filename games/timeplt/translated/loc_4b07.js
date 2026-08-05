// SPDX-License-Identifier: GPL-3.0-only

// loc_4b07  (ROM 0x4B07-0x4B18, Time Pilot) -- real code, deliberately NOT transcribed:
// nothing in the ROM reaches it, and 0x4B14 is `ld a,r`, which this core cannot model.
export function loc_4b07(m) {
  throw new Error(
    "0x4B07 was entered as a routine at cycle " + m.cycles + ", which no path in the ROM " +
      "does. A decode at every byte offset 0x0000-0x5FFF finds no call, jp, jr or djnz " +
      "targeting it; the two `07 4b` byte pairs are coincidences (0x22B3 straddles the " +
      "operand of `ld bc,0x078b`, 0x233C sits inside data), and 0x4B06 is a `ret` so " +
      "nothing falls in. Even reachable it could not be a faithful oracle: ROM 0x4B14 is " +
      "`ed 5f` = `ld a,r`, and REG_FIELDS in the Z80 core carries no R -- nothing here " +
      "fetches, so the refresh counter has no value to read at this site or any other.",
  );
}
