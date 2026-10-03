package dev.gridtwin.domain.model;

public record Branch(
        String id,
        int from,
        int to,
        double resistance,
        double reactance,
        double chargingSusceptance,
        double ratingMva,
        double tap,
        double shiftDegrees,
        boolean inService) {

    public Branch {
        if (id == null || id.isBlank()) {
            throw new IllegalArgumentException("branch id must not be blank");
        }
        if (from == to) {
            throw new IllegalArgumentException(
                    "branch " + id + " connects bus " + from + " to itself");
        }
        if (tap <= 0) {
            throw new IllegalArgumentException("tap ratio must be positive for branch " + id);
        }
        if (ratingMva <= 0) {
            throw new IllegalArgumentException("rating must be positive for branch " + id);
        }
        if (resistance == 0 && reactance == 0) {
            throw new IllegalArgumentException("branch " + id + " has no series impedance");
        }
    }

    public Branch withRating(double newRatingMva) {
        return new Branch(
                this.id,
                this.from,
                this.to,
                this.resistance,
                this.reactance,
                this.chargingSusceptance,
                newRatingMva,
                this.tap,
                this.shiftDegrees,
                this.inService);
    }

    public Branch withInService(boolean service) {
        return new Branch(
                this.id,
                this.from,
                this.to,
                this.resistance,
                this.reactance,
                this.chargingSusceptance,
                this.ratingMva,
                this.tap,
                this.shiftDegrees,
                service);
    }

    public boolean isTransformer() {
        return this.tap != 1.0 || this.shiftDegrees != 0.0;
    }
}
