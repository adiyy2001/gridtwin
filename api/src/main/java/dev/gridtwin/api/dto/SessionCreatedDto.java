package dev.gridtwin.api.dto;

import dev.gridtwin.domain.application.SessionService;
import java.time.ZonedDateTime;

public record SessionCreatedDto(
        String sessionId, ZonedDateTime createdAt, VersionedStateDto state) {

    public static SessionCreatedDto from(SessionService.Opened opened) {
        return new SessionCreatedDto(
                opened.id().value(), opened.createdAt(), VersionedStateDto.from(opened.state()));
    }
}
