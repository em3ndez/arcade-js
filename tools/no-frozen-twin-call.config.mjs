// SPDX-License-Identifier: GPL-3.0-only
//
// Per-game allowances for the frozen-twin invariant (tools/no-frozen-twin-call.mjs). Kept outside the
// game trees so a finished port can be governed without touching its directory.
//
// ALLOWED — a legacy port that predates this invariant and is deliberately NOT retrofitted (runbook:
//   "the existing ports are legacy it supersedes ... Do not retrofit them"). These idiomatic modules
//   call the frozen copy of a routine that also has an idiomatic module; the port is pixel-validated
//   and shipped, so the frozen and idiomatic forms are behaviourally equal there. Recorded, not chased.
// DEBT — an ACTIVE port's known-but-unfixed frozen-twin call: a transient state, meant to be dissolved,
//   never a resting place. Empty is the goal.
//
// A game absent from both maps is scanned strictly (a new game is fail-closed from its first module).

export const ALLOWED = {
  dkong: {
    "armTwoPlayerBoardSetup.js": [0x9ee],
    "beginMarioDeathAnimation.js": [0x30bd],
    "dispatchEffectState.js": [0x1e4a],
    "drawBoardLayout.js": [0x2ff0],
    "endKongWalkAndAdvanceInterlude.js": [0x16ee],
    "loc_07cb.js": [0x3f24],
    "loc_0dd3.js": [0x2ff0],
    "loc_1880.js": [0x1826],
    "loc_2602.js": [0x26e9],
    "losePlayer1Life.js": [0x1826],
    "pickAwardTierByObjectCount.js": [0x1e28],
    "runAttractState.js": [0x779, 0x763, 0x123c, 0x1977, 0x7c3, 0x7cb, 0x84b],
    "runIntroClimbStep.js": [0x38],
  },
};

export const DEBT = {};

/** {file: Set(addr)} for a game's map entry. */
export function toAllowMap(entry) {
  const m = new Map();
  for (const [file, addrs] of Object.entries(entry ?? {})) m.set(file, new Set(addrs));
  return m;
}
