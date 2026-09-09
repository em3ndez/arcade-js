// SPDX-License-Identifier: GPL-3.0-only
import { foldHighScoreChecksum } from "./foldHighScoreChecksum.js";
import { loc_02, loc_1a, HIGH_SCORE_TABLE, loc_017a, loc_0181, HIGH_SCORE_CONFIG_BYTE, HIGH_SCORE_INIT_TABLE, CONFIG_DIP_BYTE } from "./names.js";

/**
 * validateOrResetHighScores — boot-time integrity gate for the high-score table.
 *
 * Run once at power-up, right after the RAM mirror has been loaded out of the EAROM. Because
 * NVRAM can be corrupt, blank (first boot), or belong to a different option configuration, the
 * scores cannot be trusted as-is. This routine puts the table through a short gauntlet and
 * comes out having EITHER promoted the validated top entry into the zeropage working copy OR
 * wiped the whole table clean. Any one of {bad checksum, changed config byte, empty leading
 * entry, out-of-range BCD digit} forces the clean-table path.
 *
 * Cells involved: HIGH_SCORE_TABLE ($0178 [seen]) the 64-byte mirror; HIGH_SCORE_INIT_TABLE
 * ($3a69 [seen]) the ROM template; HIGH_SCORE_CONFIG_BYTE ($018a [seen]) the stored option
 * snapshot; CONFIG_DIP_BYTE ($00fd [seen]) the live option byte; loc_02/loc_1a the zeropage
 * working copies; loc_017a/loc_0181 entry fields inside the table.
 *
 * ROM 0x… . Grounding: [code] flow; [seen] cells as noted. Live-out: either the zeropage working
 * copy is populated from the validated table, or the table (and config snapshot) is zeroed.
 */
export function validateOrResetHighScores(m) {
  const { mem8 } = m;

  // (1) Copy the ROM template into the zeropage staging area first, so there is a defined
  // default working copy regardless of which path below runs.
  // (1) copy the template into zeropage
  for (let x = 0x2f; x >= 0; x--) mem8[loc_02 + x] = m.mem8[HIGH_SCORE_INIT_TABLE + x];

  // (2) Checksum probe: foldHighScoreChecksum returns the delta between this fold and the
  // stored checksum. A nonzero delta means the bytes no longer match their recorded checksum
  // — a corrupt or first-boot table — so wipe and record config.
  // (2) checksum probe — nonzero delta means the table changed -> reset
  const [delta] = foldHighScoreChecksum(m);
  if (delta !== 0) return zeroFillAndRecordConfig(mem8);

  // (3) Config byte: recompute the option snapshot (mask 0x7c of the live DIP byte) and
  // compare it against the stored one BEFORE overwriting. If the operator changed the relevant
  // DIP settings, record the new snapshot and bail without rebuilding — the scores are valid
  // but belong to a different configuration, so they are kept, not promoted.
  // (3) config byte: store the new snapshot; bail (no rebuild) if it changed
  const cfg = mem8[CONFIG_DIP_BYTE] & 0x7c;
  const configChanged = cfg !== mem8[HIGH_SCORE_CONFIG_BYTE]; // compare before the store
  mem8[HIGH_SCORE_CONFIG_BYTE] = cfg;
  if (configChanged) return;

  // (4) An empty leading entry (zero at loc_017a) means there is no real top score to promote
  // — treat as garbage and reset.
  // (4) a zero here means an empty entry -> reset
  if (mem8[loc_017a] === 0) return zeroFillAndRecordConfig(mem8);

  // (5) Validate and promote the top entry, byte by byte (X = 8..0). Each byte is staged into
  // the zeropage copy first; then it is range-checked as packed BCD score data. Any byte
  // >= 0x9a, or with a low nibble >= 0x0a (an illegal BCD digit), proves corruption and forces
  // the reset. A clean byte lets the paired secondary entry at loc_0181 be promoted into loc_1a.
  // (5) validate + promote the top entry (X = 8..0)
  for (let x = 0x08; x >= 0; x--) {
    const v = mem8[HIGH_SCORE_TABLE + x];
    mem8[loc_02 + x] = v;                         // stage before the range checks
    if (v >= 0x9a) return zeroFillAndRecordConfig(mem8);
    if ((v & 0x0f) >= 0x0a) return zeroFillAndRecordConfig(mem8); // illegal BCD low nibble
    mem8[loc_1a + x] = mem8[loc_0181 + x];        // promote the secondary entry
  }
}

// The clean-table path: zero the 63 table bytes (0x3e..0) and stamp the current config
// snapshot, so the freshly blanked table is immediately consistent with the machine's options
// (and its checksum will fold correctly next time).
// Wipe the table and store the config snapshot.
function zeroFillAndRecordConfig(mem8) {
  for (let x = 0x3e; x >= 0; x--) mem8[HIGH_SCORE_TABLE + x] = 0x00;
  mem8[HIGH_SCORE_CONFIG_BYTE] = mem8[CONFIG_DIP_BYTE] & 0x7c;
}
