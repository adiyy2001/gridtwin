package dev.gridtwin.validation.topology;

import dev.gridtwin.domain.topology.Position;
import java.util.Locale;

sealed interface SwitchingStep {

    record Operate(String switchId, Position position) implements SwitchingStep {

        @Override
        public String toString() {
            return this.switchId + "=" + this.position;
        }
    }

    record ScaleLoad(double factor) implements SwitchingStep {

        @Override
        public String toString() {
            return "load*" + String.format(Locale.ROOT, "%.2f", this.factor);
        }
    }
}
