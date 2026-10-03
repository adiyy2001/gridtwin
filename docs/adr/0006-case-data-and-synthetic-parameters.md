# 0006 Case data, licensing and synthetic parameters

Status: accepted

## Context

The brief names IEEE 14-bus and IEEE 30-bus from MATPOWER and describes them as BSD licensed. MATPOWER's LICENSE file says something narrower: the code is BSD 3-clause, the case files are not covered by that license, and their data "has either been included with permission or has been converted from data available from a public source". Both case files used here say they were converted from the IEEE Common Data Format files in the University of Washington Power Systems Test Case Archive.

MATPOWER has two 30-bus files. `case30` follows Alsac and Stott (1974), has no off-nominal taps and carries line limits. `case_ieee30` follows the IEEE 30-bus data from the same archive as `case14`, has four transformers with taps (0.978, 0.969, 0.932 and 0.968) and reactive limits that bind: with the slack limits widened, the generator at bus 2 sits at its upper limit in the base case. Version 2 of that file (2025-06-14) sets three more tap values to 1.0.

Neither file carries thermal ratings. `case14` has no base voltages either (`baseKV` is 0 on every bus), while `case_ieee30` lists 132, 33 and 11 kV, with bus 9 at 1 kV.

## Decision

- Use `case14` and `case_ieee30` from MATPOWER 8.1. In the UI and in the code the second one is called `ieee30`. It is a better test of the solver than `case30` because it exercises taps and reactive limits, and it comes from the same archive as `case14`.
- The repository does not contain MATPOWER's `.m` files. It contains its own JSON conversion of the numbers, written by a script in `tools/reference/`, with the source, the MATPOWER version and the conversion script named in a `provenance` block. CREDITS.md quotes MATPOWER's license text and names the University of Washington archive.
- Synthetic ratings. The rating of a branch in MVA is `max(ceil(1.25 * peak / 5) * 5, 20)`, where `peak` is the larger apparent power at the two ends in the solved base case at 100% load. The floor exists because many lines carry under 10 MVA and a pure 125% rule would put them in violation after any disturbance. The resulting ratings are committed in the JSON files and a test checks that the policy reproduces them.
- Voltage levels are used for kV labels and for currents in kA only. IEEE 14 gets synthetic levels: 132 kV for buses 1 to 5 and 33 kV for buses 6 to 14, which follows its three transformers. IEEE 30 keeps the levels in its file, except bus 9: 1 kV would give meaningless currents, so the conversion script sets it to 33 kV and says so in the provenance block.
- The substation, its bays, its layout and all coordinates are invented.

## Alternatives

`case30` carries published line limits. Using them would remove one synthetic parameter and would bring Alsac and Stott's data, whose redistribution terms are less clear than the UW archive's, into a repository that is public.

Another factor than 1.25 was considered. The brief gives 125% as an example. The bus 4 exploration in PLAN.md shows that this value gives a demo scenario with exactly one overloaded line, so it stays.

## Consequences

Every rating and voltage level in the UI is labelled as synthetic. The README repeats that the model is educational. Adrian should read the CREDITS.md wording on the case data before the repository goes public.
