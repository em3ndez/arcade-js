-- Grounding experiment: does the score ramp for consecutive common-enemy kills?
-- Coins up, starts, then holds fire and sweeps the stick so shots meet traffic.
local IN0 = manager.machine.ioport.ports[":IN0"]
local IN1 = manager.machine.ioport.ports[":IN1"]
local coin, start = IN0.fields["Coin 1"], IN0.fields["1 Player Start"]
local fire = IN1.fields["P1 Button 1"]
local dirs = { IN1.fields["P1 Up"], IN1.fields["P1 Right"], IN1.fields["P1 Down"], IN1.fields["P1 Left"] }
assert(coin and start and fire, "missing coin/start/fire")
local f = 0
_G.__st = emu.add_machine_frame_notifier(function()
  f = f + 1
  coin:set_value((f >= 400 and f < 408) and 1 or 0)
  start:set_value((f >= 500 and f < 508) and 1 or 0)
  -- tap fire rather than hold: the game arms three shots per press
  fire:set_value((f > 600 and (f % 8) < 3) and 1 or 0)
  local want = math.floor(f / 120) % 4
  for i, d in ipairs(dirs) do if d then d:set_value((i-1) == want and 1 or 0) end end
end)
