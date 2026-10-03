package dev.gridtwin.api.rest;

import dev.gridtwin.api.dto.ErrorDto;
import dev.gridtwin.api.dto.Requests;
import dev.gridtwin.api.dto.SessionCreatedDto;
import dev.gridtwin.api.dto.VersionedStateDto;
import dev.gridtwin.domain.application.SessionId;
import dev.gridtwin.domain.application.SessionService;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import java.net.URI;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.media.Content;
import org.eclipse.microprofile.openapi.annotations.media.Schema;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.jboss.resteasy.reactive.RestResponse;

@Path("/api/sessions")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "sessions")
public class SessionsResource {

    static final String DEFAULT_CASE = "ieee14";

    private final SessionService sessions;

    @Inject
    public SessionsResource(SessionService sessions) {
        this.sessions = sessions;
    }

    @POST
    @Operation(
            summary = "Create a session",
            description =
                    "Starts a twin of the chosen case with its own switch positions and load"
                            + " factor. The state is pushed over the WebSocket at"
                            + " /ws/sessions/{sessionId}.")
    @APIResponse(
            responseCode = "201",
            description = "Session created at version 1",
            content = @Content(schema = @Schema(implementation = SessionCreatedDto.class)))
    @APIResponse(
            responseCode = "429",
            description = "The session cap is reached",
            content = @Content(schema = @Schema(implementation = ErrorDto.class)))
    public RestResponse<SessionCreatedDto> create(@Valid Requests.CreateSession request) {
        String caseId = request == null ? DEFAULT_CASE : request.caseId().orElse(DEFAULT_CASE);
        SessionCreatedDto created = SessionCreatedDto.from(this.sessions.open(caseId));
        return RestResponse.ResponseBuilder.<SessionCreatedDto>created(
                        URI.create("/api/sessions/" + created.sessionId()))
                .entity(created)
                .build();
    }

    @GET
    @Path("/{sessionId}/state")
    @Operation(summary = "Read the current versioned state")
    @APIResponse(
            responseCode = "200",
            description = "OK",
            content = @Content(schema = @Schema(implementation = VersionedStateDto.class)))
    @APIResponse(
            responseCode = "404",
            description = "Unknown session",
            content = @Content(schema = @Schema(implementation = ErrorDto.class)))
    public VersionedStateDto state(@PathParam("sessionId") String sessionId) {
        return VersionedStateDto.from(this.sessions.state(new SessionId(sessionId)));
    }

    @DELETE
    @Path("/{sessionId}")
    @Operation(summary = "Close a session")
    @APIResponse(responseCode = "204", description = "Session closed")
    public RestResponse<Void> close(@PathParam("sessionId") String sessionId) {
        this.sessions.close(new SessionId(sessionId));
        return RestResponse.noContent();
    }

    @POST
    @Path("/{sessionId}/switches/{switchId}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Operate a switch",
            description =
                    "Interlocks are checked first. An accepted operation solves the network,"
                            + " raises the version and pushes the state. Operating a switch into"
                            + " its current position changes nothing.")
    @APIResponse(
            responseCode = "200",
            description = "OK",
            content = @Content(schema = @Schema(implementation = VersionedStateDto.class)))
    @APIResponse(
            responseCode = "409",
            description = "The operation is refused by an interlock",
            content = @Content(schema = @Schema(implementation = ErrorDto.class)))
    @APIResponse(
            responseCode = "404",
            description = "Unknown session or switch",
            content = @Content(schema = @Schema(implementation = ErrorDto.class)))
    public VersionedStateDto operate(
            @PathParam("sessionId") String sessionId,
            @PathParam("switchId") String switchId,
            @NotNull @Valid Requests.OperateSwitch request) {
        return VersionedStateDto.from(
                this.sessions.operate(new SessionId(sessionId), switchId, request.position()));
    }

    @PUT
    @Path("/{sessionId}/load-factor")
    @Consumes(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Scale all loads",
            description =
                    "The factor must be between 0.5 and 1.5. Generators keep their setpoints and"
                            + " the slack absorbs the change.")
    @APIResponse(
            responseCode = "200",
            description = "OK",
            content = @Content(schema = @Schema(implementation = VersionedStateDto.class)))
    @APIResponse(
            responseCode = "400",
            description = "The factor is outside the range",
            content = @Content(schema = @Schema(implementation = ErrorDto.class)))
    public VersionedStateDto loadFactor(
            @PathParam("sessionId") String sessionId,
            @NotNull @Valid Requests.SetLoadFactor request) {
        return VersionedStateDto.from(
                this.sessions.setLoadFactor(new SessionId(sessionId), request.loadFactor()));
    }
}
