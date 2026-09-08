// SPDX-License-Identifier: GPL-3.0-only
// The ONE place a game's Machine is built from its ROM images. The web worker AND every node harness/gate
// construct through this, so a manifest<->constructor divergence cannot hide in a path that builds it
// differently -- the root all four galaxian browser-only bugs shared (a gfx image key, an input port index):
// the pixel harness read opts.gfx while the worker passed opts.gfx1, and a test translated ports the worker
// keyed raw. See docs/runbook.md §5 "New-subsystem DONE doctrine" + docs/reviewer-rules.md.
//
// `images` is { <manifest.rom.images name>: Uint8Array } -- maincpu is the positional ROM arg; the non-maincpu
// images (gfx1/gfx/proms/tiles/... whatever the manifest names) spread by NAME into opts, so the game's
// machine.js reads them by their manifest key and NO caller may rename/translate them. `inputs` is an already-
// constructed board Inputs instance; `MachineClass` is the game Machine (or a LiveMachine subclass).
export function buildGameMachine(MachineClass, inputs, images, overrides) {
  const { maincpu, ...gfx } = images;
  return new MachineClass(maincpu, { inputs, ...gfx, overrides });
}
