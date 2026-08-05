// SPDX-License-Identifier: GPL-3.0-only

// loc_5277  (ROM 0x5277-0x5285, Time Pilot) -- real code, deliberately NOT transcribed:
// nothing in the ROM reaches it.
export function loc_5277(m) {
  throw new Error(
    "0x5277 was entered as a routine at cycle " + m.cycles + ", which no path in the ROM " +
      "does. A decode at every byte offset 0x0000-0x5FFF finds no call, jp, jr or djnz " +
      "targeting it, the byte pair 77 52 appears nowhere, and 0x5276 is a `ret` so nothing " +
      "falls in. The live entry to this region is 0x5286. Its own `call nz,0x53d4` at 0x5283 " +
      "would enter a data table, and is guarded by a checksum that passes on a genuine image.",
  );
}
