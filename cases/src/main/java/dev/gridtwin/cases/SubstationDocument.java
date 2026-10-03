package dev.gridtwin.cases;

import dev.gridtwin.domain.topology.Bay;
import dev.gridtwin.domain.topology.BayKind;
import dev.gridtwin.domain.topology.Busbar;
import dev.gridtwin.domain.topology.Node;
import dev.gridtwin.domain.topology.Position;
import dev.gridtwin.domain.topology.Substation;
import dev.gridtwin.domain.topology.Switch;
import dev.gridtwin.domain.topology.SwitchKind;
import dev.gridtwin.domain.topology.Terminal;
import dev.gridtwin.domain.topology.TerminalKind;
import java.util.List;
import java.util.Optional;

record SubstationDocument(
        String id,
        String name,
        String note,
        int bus,
        double baseKv,
        List<BusbarRow> busbars,
        List<NodeRow> nodes,
        List<BayRow> bays,
        List<SwitchRow> switches) {

    Substation toSubstation() {
        return new Substation(
                this.id,
                this.name,
                this.bus,
                this.baseKv,
                this.busbars.stream().map(BusbarRow::toBusbar).toList(),
                this.nodes.stream().map(NodeRow::toNode).toList(),
                this.bays.stream().map(BayRow::toBay).toList(),
                this.switches.stream().map(SwitchRow::toSwitch).toList());
    }

    record BusbarRow(String node, int bus, String name, int row) {

        Busbar toBusbar() {
            return new Busbar(this.node, this.bus, this.name, this.row);
        }
    }

    record NodeRow(String id) {

        Node toNode() {
            return new Node(this.id);
        }
    }

    record TerminalRow(String node, TerminalKind kind, String equipment) {

        Terminal toTerminal() {
            return new Terminal(this.node, this.kind, this.equipment);
        }
    }

    record BayRow(String id, String name, BayKind kind, int column, TerminalRow terminal) {

        Bay toBay() {
            return new Bay(
                    this.id,
                    this.name,
                    this.kind,
                    this.column,
                    Optional.ofNullable(this.terminal).map(TerminalRow::toTerminal));
        }
    }

    record SwitchRow(
            String id, SwitchKind kind, String bay, String from, String to, Position position) {

        Switch toSwitch() {
            return new Switch(this.id, this.kind, this.bay, this.from, this.to, this.position);
        }
    }
}
