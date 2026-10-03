package dev.gridtwin.api.dto;

import dev.gridtwin.cases.BusPosition;
import dev.gridtwin.cases.CaseData;
import dev.gridtwin.domain.model.Branch;
import dev.gridtwin.domain.model.Bus;
import dev.gridtwin.domain.model.BusType;
import dev.gridtwin.domain.model.Generator;
import dev.gridtwin.domain.model.Load;
import java.util.List;
import java.util.Optional;

public record CaseDetailDto(
        String id,
        String title,
        String disclaimer,
        double baseMva,
        ProvenanceDto provenance,
        List<BusDto> buses,
        List<BranchDto> branches,
        List<GeneratorDto> generators,
        List<LoadDto> loads,
        Optional<SubstationDto> substation) {

    public static final String DISCLAIMER =
            "Educational model on public IEEE test data. Ratings, voltage levels, layout and the"
                    + " substation are synthetic and describe no real installation.";

    public static CaseDetailDto from(CaseData data) {
        return new CaseDetailDto(
                data.id(),
                data.title(),
                DISCLAIMER,
                data.network().baseMva(),
                new ProvenanceDto(
                        data.provenance().source(),
                        data.provenance().ratingPolicy(),
                        data.provenance().voltagePolicy(),
                        data.provenance().layoutPolicy()),
                data.network().buses().stream()
                        .map(bus -> BusDto.from(bus, data.positionOf(bus.number())))
                        .toList(),
                data.network().branches().stream().map(BranchDto::from).toList(),
                data.network().generators().stream().map(GeneratorDto::from).toList(),
                data.network().loads().stream().map(LoadDto::from).toList(),
                data.substation().map(SubstationDto::from));
    }

    public record ProvenanceDto(
            String source, String ratingPolicy, String voltagePolicy, String layoutPolicy) {}

    public record BusDto(
            int number,
            BusType type,
            double baseKv,
            double voltageMin,
            double voltageMax,
            Optional<Double> x,
            Optional<Double> y) {

        static BusDto from(Bus bus, Optional<BusPosition> position) {
            return new BusDto(
                    bus.number(),
                    bus.type(),
                    bus.baseKv(),
                    bus.voltageMin(),
                    bus.voltageMax(),
                    position.map(BusPosition::x),
                    position.map(BusPosition::y));
        }
    }

    public record BranchDto(
            String id,
            int from,
            int to,
            double ratingMva,
            double tap,
            double shiftDegrees,
            boolean transformer) {

        static BranchDto from(Branch branch) {
            return new BranchDto(
                    branch.id(),
                    branch.from(),
                    branch.to(),
                    branch.ratingMva(),
                    branch.tap(),
                    branch.shiftDegrees(),
                    branch.isTransformer());
        }
    }

    public record GeneratorDto(
            String id, int bus, double activeMinMw, double activeMaxMw, double activeMw) {

        static GeneratorDto from(Generator generator) {
            return new GeneratorDto(
                    generator.id(),
                    generator.bus(),
                    generator.activeMinMw(),
                    generator.activeMaxMw(),
                    generator.activePowerMw());
        }
    }

    public record LoadDto(int bus, double activeMw, double reactiveMvar) {

        static LoadDto from(Load load) {
            return new LoadDto(load.bus(), load.activePowerMw(), load.reactivePowerMvar());
        }
    }
}
