package dev.gridtwin.api.dto;

import dev.gridtwin.domain.application.Versioned;

public record VersionedStateDto(long version, StateDto state) {

    public static VersionedStateDto from(Versioned versioned) {
        return new VersionedStateDto(
                versioned.version(),
                StateDto.from(versioned.solution().state(), versioned.solution().grid()));
    }
}
