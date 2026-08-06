-- Time Pilot driver for tools/reach_sweep.lua.
--
-- Without a driver the sweep measures attract mode, and a not-reached list built that way says
-- more about the tape than the ROM. This coins up, starts, then flies: it holds fire continuously
-- and walks the stick around the compass so the heading table, the turn-rate path and the
-- per-object chains all run, and it re-coins whenever play stops so a death does not end the run.
local IN0 = manager.machine.ioport.ports[":IN0"]
local IN1 = manager.machine.ioport.ports[":IN1"]
assert(IN0 and IN1, "missing :IN0 / :IN1")
local coin  = IN0.fields["Coin 1"]
local start = IN0.fields["1 Player Start"]
local fire  = IN1.fields["P1 Button 1"] or IN1.fields["P1 Button 1 "] 
local dirs  = { IN1.fields["P1 Up"], IN1.fields["P1 Right"], IN1.fields["P1 Down"], IN1.fields["P1 Left"] }
assert(coin and start, "missing Coin 1 / 1 Player Start")

return function(f, mem)
  -- re-coin every 30s so a death does not leave the rest of the run in attract
  local phase = f % 1800
  coin:set_value((phase >= 60 and phase < 68) and 1 or 0)
  start:set_value((phase >= 120 and phase < 128) and 1 or 0)
  if fire then fire:set_value((f % 6 < 3) and 1 or 0) end
  -- walk the stick round the compass, one direction at a time, changing every 90 frames
  local want = math.floor(f / 90) % 4
  for i, d in ipairs(dirs) do
    if d then d:set_value((i - 1) == want and 1 or 0) end
  end
end
