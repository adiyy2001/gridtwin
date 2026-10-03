package dev.gridtwin.domain.topology;

public sealed interface Refusal {

    String switchId();

    String code();

    String message();

    record UnknownSwitch(String switchId) implements Refusal {

        @Override
        public String code() {
            return "UNKNOWN_SWITCH";
        }

        @Override
        public String message() {
            return "There is no switch with id " + this.switchId + ".";
        }
    }

    record BreakerNotOpen(String switchId, String breakerId) implements Refusal {

        @Override
        public String code() {
            return "BREAKER_CLOSED";
        }

        @Override
        public String message() {
            return "Disconnector "
                    + this.switchId
                    + " cannot be operated while breaker "
                    + this.breakerId
                    + " is closed. Open the breaker first.";
        }
    }

    record SectionEnergized(String switchId, String section) implements Refusal {

        @Override
        public String code() {
            return "SECTION_ENERGIZED";
        }

        @Override
        public String message() {
            return "Earthing switch "
                    + this.switchId
                    + " cannot close: "
                    + this.section
                    + " is energized. De-energize it first.";
        }
    }

    record EarthedSectionWouldBeEnergized(
            String switchId, String earthedSection, String liveSection) implements Refusal {

        @Override
        public String code() {
            return "EARTHED_SECTION_WOULD_BE_ENERGIZED";
        }

        @Override
        public String message() {
            return "Closing "
                    + this.switchId
                    + " would connect "
                    + this.earthedSection
                    + ", which is earthed, to "
                    + this.liveSection
                    + ", which is energized. Open the earthing switch first.";
        }
    }
}
