# 0021 Single-line diagram: derived layout and hand-drawn symbols

Status: accepted

## Context

The diagram has to show the substation described by the case file: two busbars, a coupler and feeder bays with a bus disconnector per busbar, a breaker, a line disconnector and an earthing switch. It has to stay correct for any substation description the API sends, show open and closed positions and the electrical state of every section, and never rely on colour alone. Commercial diagram libraries are ruled out, so the symbols and the renderer are written from scratch.

## Decision

The layout is a pure function of the substation description (`buildSldLayout`), with no hand-placed coordinates.

- Bays go in columns by their `column` field. Busbars are horizontal lines, one row per busbar in `row` order.
- A feeder bay is found by structure: the disconnectors that touch a busbar node become spurs, the breaker joins the bus-side node to the line-side node, the disconnector that touches the breaker's other node is the line disconnector, and earthing switches hang beside the node they ground. A bay without a breaker is skipped instead of drawn wrong.
- The coupler is a U shape: one leg from the first busbar down through the breaker, a bottom run, and a second leg up to the other busbar.
- Every wire belongs to a node. The state of that node (`ENERGIZED`, `DEENERGIZED`, `EARTHED`) comes from the pushed state and decides the line style: solid, dashed grey, dotted purple. Each bay caption also says the state in words.
- Symbols follow the IEC 60617 convention as far as a screen drawing allows: a switch is a blade pivoting on one terminal, straight when closed and angled when open. A breaker adds the cross at the contact, a disconnector a contact bar, an earthing switch ends in the earth symbol. A transformer is two circles, a line exit an open arrow, a load a filled arrow. The blade angle is the non-colour cue for the position.
- Terminals show the active power leaving or entering the substation and the loading. An overloaded branch gets a red label with a "!" and a red outline.

A state-model function turns layout and state into a render model. It is tested without a DOM. The Angular component only binds it.

## Keyboard model

Equipment is a roving tabindex group: one tab stop, arrow keys move by position on the drawing (nearest item in that direction, with a penalty for being off the axis), Home and End jump to the first and last item in reading order. A busbar is a long item, so Left and Right step through the disconnectors attached to it and Down enters the column nearest to where focus came from. Busbars are not a target when moving down past them. Enter or Space on a switch selects it and asks for a confirmation, Escape clears the selection. Moving focus with the arrows also selects, so the inspector follows.

## Alternatives

A force-directed or generic graph layout would draw any network but would not look like a substation. Hand-placed coordinates per case would break as soon as a bay is added. A tab stop on every item would put dozens of stops in front of the rest of the page.

## Consequences

The layout depends on the naming-free structure of the description (busbar nodes, one breaker per bay), not on switch ids. A substation shape outside that structure (a one-and-a-half breaker scheme) needs a new layout function. The substation in the case file and other double busbar schemes work. When the coupler splits the bus, the second busbar selects bus 40, and while the two are merged both busbars select bus 4.
