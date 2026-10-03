package dev.gridtwin.api.dto;

import dev.gridtwin.domain.topology.Bay;
import dev.gridtwin.domain.topology.BayKind;
import dev.gridtwin.domain.topology.Busbar;
import dev.gridtwin.domain.topology.Substation;
import dev.gridtwin.domain.topology.Terminal;
import dev.gridtwin.domain.topology.TerminalKind;
import java.util.List;
import java.util.Optional;

public record SubstationDto(
        String id,
        String name,
        int bus,
        double baseKv,
        List<BusbarDto> busbars,
        List<String> nodes,
        List<BayDto> bays,
        List<SwitchDto> switches) {

    public static SubstationDto from(Substation substation) {
        return new SubstationDto(
                substation.id(),
                substation.name(),
                substation.busNumber(),
                substation.baseKv(),
                substation.busbars().stream().map(BusbarDto::from).toList(),
                substation.nodes().stream().map(node -> node.id()).toList(),
                substation.bays().stream().map(BayDto::from).toList(),
                substation.switches().stream().map(SwitchDto::from).toList());
    }

    public record BusbarDto(String node, int bus, String name, int row) {

        static BusbarDto from(Busbar busbar) {
            return new BusbarDto(busbar.nodeId(), busbar.busNumber(), busbar.name(), busbar.row());
        }
    }

    public record BayDto(
            String id, String name, BayKind kind, int column, Optional<TerminalDto> terminal) {

        static BayDto from(Bay bay) {
            return new BayDto(
                    bay.id(),
                    bay.name(),
                    bay.kind(),
                    bay.column(),
                    bay.terminal().map(TerminalDto::from));
        }
    }

    public record TerminalDto(String node, TerminalKind kind, String equipment) {

        static TerminalDto from(Terminal terminal) {
            return new TerminalDto(terminal.nodeId(), terminal.kind(), terminal.equipmentId());
        }
    }
}
