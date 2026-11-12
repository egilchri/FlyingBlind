// FlyingBlind flashlight scanner: printable case.
//
// Three parts, all printed without supports:
//   body   head + neck + handle in one piece. Print standing on its front rim.
//   bezel  front window that holds the TF-Luna. Print flange down.
//   cap    tail cap with a lanyard loop. Print with the plug down, loop up.
// Pick a part with -D 'part="body"' (or "bezel", "cap", "all" to preview).
//
// Inside the head, from the front: the sensor (held by the bezel), the board
// on the floor, the buzzer under the grille, and the cable's switch at the back
// under the button. The power bank fills the handle; its USB plug and the
// spare cable fold into the neck.
//
// Units are mm. Measure your own power bank and switch cable before printing,
// and change the values in "Measure these" if they differ.
// Nothing here has been printed yet: print the bezel and cap first (they're
// quick) to check the fits before committing to the body.

part = "all";

// ---------------- Measure these ----------------
bank_d        = 25;    // power bank diameter (the largest point)
bank_len      = 95;    // power bank length, without the cable plugged in
// The USB-A plug and the bent cable (about 22 mm) sit in the neck, behind the switch.
switch_w      = 13;    // switch button opening, across the handle
switch_l      = 9;     // switch button opening, along the handle
fit           = 0.3;   // clearance for parts that slide together; 0.2-0.4 suits most printers

// ---------------- Parts inside the head ----------------
luna_w = 35;      // TF-Luna, across (z in the 3D picture)
luna_h = 21.25;   // TF-Luna, height
luna_d = 13.5;    // TF-Luna, depth (front to back)
lens_window_w = 31;   // window in the bezel: big enough for both lenses
lens_window_h = 15;

// ---------------- Shape ----------------
wall      = 2.4;
head_od   = 48;
head_len  = 62;   // front rim to the neck: sensor, board, buzzer, and the switch at the back
neck_len  = 14;
handle_od = bank_d + 2 * fit + 2 * wall + 1;   // about 31 mm
cap_plug  = 10;
handle_len = bank_len + cap_plug + 2;          // the USB plug and cable sit in the neck and the back of the head
flat_depth = 2;   // a flat under the head stops it rolling off a table, and says "this side down"
grille_holes = [[0,0],[3.2,0],[-3.2,0],[1.6,2.8],[-1.6,2.8],[1.6,-2.8],[-1.6,-2.8],
                [4.8,2.8],[-4.8,2.8],[4.8,-2.8],[-4.8,-2.8]];
grille_hole_d = 2;
grille_z  = 22;   // grille centre, from the front rim (over the buzzer)
button_z  = 50;   // switch opening centre, from the front rim (top of the head, just ahead of the neck)

head_id   = head_od - 2 * wall;
// The flat underneath would leave the bottom wall paper-thin, so the inside
// gets a flat floor a full wall thick. Its top is where the board sits.
floor_y   = -head_od / 2 + flat_depth + wall;   // about 18 mm wide at the top
handle_id = bank_d + 2 * fit;

$fn = 96;

// The body's axis runs along z. z = 0 is the front rim; the tail is at the top.
// "Up" on the finished scanner (button, grille) is +y.
total_len = head_len + neck_len + handle_len;

module body() {
  difference() {
    union() {
      cylinder(d = head_od, h = head_len);
      translate([0, 0, head_len]) cylinder(d1 = head_od, d2 = handle_od, h = neck_len);
      translate([0, 0, head_len + neck_len]) cylinder(d = handle_od, h = handle_len);
      // a raised rim around the button, so the thumb finds it without looking.
      // A block on top of the head, trimmed to a slightly bigger cylinder so
      // its top follows the head's curve.
      intersection() {
        translate([0, 0, button_z]) rotate([-90, 0, 0])
          hull() for (s = [-1, 1])
            translate([s * (switch_w - switch_l) / 2, 0, 0]) cylinder(d = switch_l + 5, h = head_od, $fn = 48);
        cylinder(r = head_od / 2 + 1.2, h = head_len);
      }
    }
    // hollow head, open at the front for the bezel and the parts
    translate([0, 0, -1]) cylinder(d = head_id, h = head_len + 1.01);
    // hollow neck
    translate([0, 0, head_len]) cylinder(d1 = head_id, d2 = handle_id, h = neck_len + 0.01);
    // hollow handle, open at the tail for the power bank
    translate([0, 0, head_len + neck_len]) cylinder(d = handle_id, h = handle_len + 1);
    // flat underneath the head and neck
    translate([-head_od, -head_od / 2 - 50 + flat_depth, -1]) cube([2 * head_od, 50, head_len + neck_len + 1]);
    // buzzer grille on top of the head, halfway along it
    for (h = grille_holes)
      translate([h[0], 0, grille_z + h[1]]) rotate([-90, 0, 0]) cylinder(d = grille_hole_d, h = head_od, $fn = 24);
    // switch button opening on top of the head (a rounded slot)
    translate([0, 0, button_z]) rotate([-90, 0, 0])
      hull() for (s = [-1, 1])
        translate([s * (switch_w - switch_l) / 2, 0, 0]) cylinder(d = switch_l, h = handle_od, $fn = 48);
  }
  // flat floor inside the head and the start of the neck
  intersection() {
    union() {
      cylinder(d = head_id + 0.02, h = head_len);
      translate([0, 0, head_len]) cylinder(d1 = head_id + 0.02, d2 = handle_id, h = neck_len);
    }
    translate([-head_od, -head_od, -0.01]) cube([2 * head_od, head_od + floor_y, head_len + neck_len]);
  }
}

// Bezel: a plug that presses into the front of the head. A pocket on the
// back holds the sensor's face; the window lets the lenses see out.
bezel_plug = 6;
module bezel() {
  difference() {
    union() {
      cylinder(d = head_od, h = 2);                       // flange (the front face)
      cylinder(d = head_id - fit, h = 2 + bezel_plug);    // plug
    }
    // window
    translate([-lens_window_w / 2, -lens_window_h / 2, -1]) cube([lens_window_w, lens_window_h, 10]);
    // pocket for the sensor's face, from the back
    translate([-(luna_w + fit) / 2, -(luna_h + fit) / 2, 1.2]) cube([luna_w + fit, luna_h + fit, 20]);
    // match the flat under the head
    translate([-head_od, -head_od / 2 - 50 + flat_depth, -1]) cube([2 * head_od, 50, 20]);
    // the plug's underside matches the flat floor inside the head
    translate([-head_od, floor_y + fit / 2 - 50, 2]) cube([2 * head_od, 50, bezel_plug + 1]);
    // a notch at the top edge of the flange, so you can feel which way up it goes in
    translate([0, head_od / 2 - 1.2, -1]) cylinder(d = 3, h = 2.5, $fn = 24);
  }
}

// Tail cap: presses into the handle, with a loop for a wrist lanyard.
module cap() {
  plug_h = cap_plug;
  difference() {
    union() {
      cylinder(d = handle_od, h = 3);
      cylinder(d = handle_id - fit, h = 3 + plug_h);
      // two small bumps for grip (a little interference)
      for (a = [0, 180]) rotate([0, 0, a]) translate([handle_id / 2 - fit / 2, 0, 3 + plug_h / 2])
        scale([0.6, 1, 1]) sphere(d = 2, $fn = 24);
    }
    translate([0, 0, 3]) cylinder(d = handle_id - fit - 2 * wall, h = plug_h + 1);   // hollow, saves plastic
  }
  // lanyard loop on the outside face
  translate([0, 0, 0]) rotate([0, 180, 0]) difference() {
    hull() {
      translate([-5, -2, 0]) cube([10, 4, 0.1]);
      translate([0, 0, 8]) rotate([90, 0, 0]) cylinder(d = 10, h = 4, center = true);
    }
    translate([0, 0, 8]) rotate([90, 0, 0]) cylinder(d = 5, h = 6, center = true);
  }
}

if (part == "body") body();
else if (part == "bezel") bezel();
else if (part == "cap") translate([0, 0, 13]) rotate([180, 0, 0]) cap();   // plug down, loop up
else {
  color("orange") body();
  color("dimgray") translate([0, 0, -12]) bezel();
  color("orange") translate([0, 0, total_len + 14]) rotate([180, 0, 0]) cap();
}
