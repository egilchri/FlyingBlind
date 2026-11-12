# Flashlight scanner case

A printable case for the no-solder flashlight scanner (see `docs/flashlight-scanner.html` and
`docs/flashlight-parts.html`). Three parts, no supports needed:

| File | Part | Print orientation |
|---|---|---|
| `body.stl` | Head, neck and handle in one piece | Standing on its front rim (as exported) |
| `bezel.stl` | Front window that holds the TF-Luna | Front face down (as exported) |
| `cap.stl` | Tail cap with lanyard loop | Plug down, loop up (as exported) |

Sliced in Bambu Studio for an A1 (0.4 mm nozzle, 0.20 mm Standard, Bambu PLA Basic): about 7 h 45 min
and 18.5 m of filament (about 55 g) for all three together, with no supports. The body is 183 mm tall
standing, so the printer needs at least that much height. (Those figures were measured before the
flat floor inside the head was added, which uses about 2 g more.)

**Not printed yet.** Print the bezel and the tail cap first. They take minutes, and they check the two
press fits before you spend hours on the body.

## Measure your parts first

The sizes the case assumes are at the top of `flashlight-case.scad`, under "Measure these":

- `bank_d` (25 mm) and `bank_len` (95 mm): the power bank's widest diameter and its length.
- `switch_w` (13 mm) and `switch_l` (9 mm): the opening the switch's button pokes through.
- `fit` (0.3 mm): the clearance for parts that slide together. If the bezel or cap is too tight, raise
  it to 0.4. If they're loose, lower it to 0.2.

## Making the STLs again after a change

Install OpenSCAD (`brew install --cask openscad@snapshot`), then:

```sh
cd hardware/flashlight-case
for p in body bezel cap; do openscad -o $p.stl -D "part=\"$p\"" flashlight-case.scad; done
```

Open `flashlight-case.scad` in OpenSCAD and press F5 to see all three parts together.

## What goes where

- **Head, from the front:** the bezel, holding the sensor's face in a pocket behind its window; the
  XIAO board on the floor; the buzzer module under the grille (both held with foam tape); and the
  switch on the USB cable at the back, under the opening on top. A raised rim around the opening
  lets the thumb find the button.
- **Neck:** the power bank's USB plug and the spare cable.
- **Handle:** the power bank. Pull the tail cap to slide it out for charging.
- **Flat underneath the head:** stops the scanner rolling off a table, and marks which way is down.
  Inside, the head has a matching flat floor about 18 mm wide, just wider than the XIAO board, so the
  board sits flat on it. The bezel's plug has a flat on its underside to match, so it only goes in
  one way up.
- **Notch on the bezel's rim:** goes at the top, so it can be fitted the right way up by touch.
