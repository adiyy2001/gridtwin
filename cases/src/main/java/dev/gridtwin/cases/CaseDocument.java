package dev.gridtwin.cases;

import dev.gridtwin.domain.model.Branch;
import dev.gridtwin.domain.model.Bus;
import dev.gridtwin.domain.model.BusType;
import dev.gridtwin.domain.model.Generator;
import dev.gridtwin.domain.model.Load;
import dev.gridtwin.domain.model.Network;
import dev.gridtwin.domain.model.Shunt;
import dev.gridtwin.domain.topology.Substation;
import java.util.List;
import java.util.Optional;

record CaseDocument(
        String id,
        String title,
        Provenance provenance,
        double baseMva,
        List<BusRow> buses,
        List<LoadRow> loads,
        List<ShuntRow> shunts,
        List<GeneratorRow> generators,
        List<BranchRow> branches,
        List<BusPosition> layout) {

    CaseData toCaseData(Optional<Substation> substation) {
        Network network =
                new Network(
                        this.id,
                        this.baseMva,
                        this.buses.stream().map(BusRow::toBus).toList(),
                        this.loads.stream().map(LoadRow::toLoad).toList(),
                        this.shunts.stream().map(ShuntRow::toShunt).toList(),
                        this.generators.stream().map(GeneratorRow::toGenerator).toList(),
                        this.branches.stream().map(BranchRow::toBranch).toList());
        return new CaseData(this.id, this.title, this.provenance, network, this.layout, substation);
    }

    record BusRow(
            int number,
            BusType type,
            double baseKv,
            double vMin,
            double vMax,
            double voltageMagnitude,
            double voltageAngleDegrees) {

        Bus toBus() {
            return new Bus(
                    this.number,
                    this.type,
                    this.baseKv,
                    this.vMin,
                    this.vMax,
                    this.voltageMagnitude,
                    this.voltageAngleDegrees);
        }
    }

    record LoadRow(int bus, double pMw, double qMvar) {

        Load toLoad() {
            return new Load(this.bus, this.pMw, this.qMvar);
        }
    }

    record ShuntRow(int bus, double gMw, double bMvar) {

        Shunt toShunt() {
            return new Shunt(this.bus, this.gMw, this.bMvar);
        }
    }

    record GeneratorRow(
            String id,
            int bus,
            double pMw,
            double qMvar,
            double qMinMvar,
            double qMaxMvar,
            double pMinMw,
            double pMaxMw,
            double voltageSetpoint,
            boolean inService) {

        Generator toGenerator() {
            return new Generator(
                    this.id,
                    this.bus,
                    this.pMw,
                    this.qMvar,
                    this.qMinMvar,
                    this.qMaxMvar,
                    this.pMinMw,
                    this.pMaxMw,
                    this.voltageSetpoint,
                    this.inService);
        }
    }

    record BranchRow(
            String id,
            int from,
            int to,
            double r,
            double x,
            double b,
            double ratingMva,
            double tap,
            double shiftDegrees,
            boolean inService) {

        Branch toBranch() {
            return new Branch(
                    this.id,
                    this.from,
                    this.to,
                    this.r,
                    this.x,
                    this.b,
                    this.ratingMva,
                    this.tap,
                    this.shiftDegrees,
                    this.inService);
        }
    }
}
