// SPDX-License-Identifier: GPL-3.0-only
// Space Invaders sound map -- DATA ONLY (read by the web audio adapter; never reads back).
// SI sound is discrete-analogue via OUT 3/5 (no sound CPU, no sample ROM); one trigger per bit.
// `kind` from the game's real OUT-port usage (record_samples.py + gameplay hold analysis): the UFO
// (OUT3 b0) is HELD while the saucer flies -> `loop`; every other sounding bit is game-pulsed -> `oneshot`
// (its recorded clip carries the full envelope, played once on the 0->1 edge); OUT3 b5 is the amp/mute
// control, silent in isolation -> `none`, no clip. `clip` = record_samples.py id; `measured` = its reading.
export const KINDS = ["oneshot", "loop", "none"];
export const SOURCES = ["discrete", "none"];
export const PORTS = { sound1: 3, sound2: 5 }; // OUT 3, OUT 5 (8080 OUT n / board portOut)

// Keyed "<port>:<bit>".
export const SOUNDS = {
  "3:0": { name: "ufo", kind: "loop", source: "discrete", clip: "out3_b0.wav", measured: "steady-tone" },
  "3:1": { name: "playerShot", kind: "oneshot", source: "discrete", clip: "out3_b1.wav", measured: "one-shot" },
  "3:2": { name: "playerExplosion", kind: "oneshot", source: "discrete", clip: "out3_b2.wav", measured: "one-shot" },
  "3:3": { name: "invaderDie", kind: "oneshot", source: "discrete", clip: "out3_b3.wav", measured: "one-shot" },
  "3:4": { name: "extraLife", kind: "oneshot", source: "discrete", clip: "out3_b4.wav", measured: "steady-tone" },
  "3:5": { name: "ampControl", kind: "none", source: "none", measured: "silent" },
  "5:0": { name: "fleetMove1", kind: "oneshot", source: "discrete", clip: "out5_b0.wav", measured: "steady-tone" },
  "5:1": { name: "fleetMove2", kind: "oneshot", source: "discrete", clip: "out5_b1.wav", measured: "steady-tone" },
  "5:2": { name: "fleetMove3", kind: "oneshot", source: "discrete", clip: "out5_b2.wav", measured: "steady-tone" },
  "5:3": { name: "fleetMove4", kind: "oneshot", source: "discrete", clip: "out5_b3.wav", measured: "steady-tone" },
  "5:4": { name: "saucerHit", kind: "oneshot", source: "discrete", clip: "out5_b4.wav", measured: "steady-tone" },
};
