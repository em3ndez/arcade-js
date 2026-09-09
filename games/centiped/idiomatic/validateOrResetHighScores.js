// SPDX-License-Identifier: GPL-3.0-only
import { foldHighScoreChecksum } from "./foldHighScoreChecksum.js";
import { loc_02, loc_1a, loc_0178, loc_017a, loc_0181, loc_018a, loc_3a69, loc_fd } from "./names.js";

/**
 * validateOrResetHighScores — boot-time integrity gate for the high-score table. Verifies it
 * against its checksum and a config-byte snapshot, then either promotes the validated top entry
 * into the zeropage working copy or wipes the whole table back to zero. A corrupt/first-boot
 * table, a changed config byte, or an out-of-range BCD entry all force the clean-table path. [code]
 */
export function validateOrResetHighScores(m) {
  const { mem8 } = m;

  // (1) copy the template into zeropage
  for (let x = 0x2f; x >= 0; x--) mem8[loc_02 + x] = m.mem8[loc_3a69 + x];

  // (2) checksum probe — nonzero delta means the table changed -> reset
  const [delta] = foldHighScoreChecksum(m);
  if (delta !== 0) return zeroFillAndRecordConfig(mem8);

  // (3) config byte: store the new snapshot; bail (no rebuild) if it changed
  const cfg = mem8[loc_fd] & 0x7c;
  const configChanged = cfg !== mem8[loc_018a]; // compare before the store
  mem8[loc_018a] = cfg;
  if (configChanged) return;

  // (4) a zero here means an empty entry -> reset
  if (mem8[loc_017a] === 0) return zeroFillAndRecordConfig(mem8);

  // (5) validate + promote the top entry (X = 8..0)
  for (let x = 0x08; x >= 0; x--) {
    const v = mem8[loc_0178 + x];
    mem8[loc_02 + x] = v;                         // stage before the range checks
    if (v >= 0x9a) return zeroFillAndRecordConfig(mem8);
    if ((v & 0x0f) >= 0x0a) return zeroFillAndRecordConfig(mem8); // illegal BCD low nibble
    mem8[loc_1a + x] = mem8[loc_0181 + x];        // promote the secondary entry
  }
}

// Wipe the table and store the config snapshot.
function zeroFillAndRecordConfig(mem8) {
  for (let x = 0x3e; x >= 0; x--) mem8[loc_0178 + x] = 0x00;
  mem8[loc_018a] = mem8[loc_fd] & 0x7c;
}
