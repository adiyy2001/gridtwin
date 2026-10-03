package dev.gridtwin.cases;

public record Provenance(
        String source,
        String generatedBy,
        String matpowerVersion,
        String matpowerArchiveSha256,
        String octaveVersion,
        String dockerImage,
        double powerFlowTolerance,
        int powerFlowMaxIterations,
        String ratingPolicy,
        String voltagePolicy,
        String layoutPolicy) {}
