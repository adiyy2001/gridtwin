package dev.gridtwin.api.rest;

import dev.gridtwin.api.dto.CascadeDto;
import dev.gridtwin.api.dto.ContingencyPreviewDto;
import dev.gridtwin.api.dto.ContingencyReportDto;
import dev.gridtwin.api.dto.ErrorDto;
import dev.gridtwin.api.dto.Requests;
import dev.gridtwin.domain.application.SessionId;
import dev.gridtwin.domain.application.SessionService;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.media.Content;
import org.eclipse.microprofile.openapi.annotations.media.Schema;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

@Path("/api/sessions/{sessionId}/analyses")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "analyses")
public class AnalysesResource {

    private final SessionService sessions;

    @Inject
    public AnalysesResource(SessionService sessions) {
        this.sessions = sessions;
    }

    @POST
    @Path("/n-1")
    @Operation(
            summary = "Run N-1 contingency analysis",
            description =
                    "One outage per branch and generator in service, solved from a warm start in"
                            + " parallel and ranked by severity. The result is kept until the"
                            + " state changes.")
    public ContingencyReportDto runContingencies(@PathParam("sessionId") String sessionId) {
        return ContingencyReportDto.from(this.sessions.runContingencies(new SessionId(sessionId)));
    }

    @GET
    @Path("/n-1")
    @Operation(summary = "Read the kept N-1 result for the current state")
    @APIResponse(
            responseCode = "404",
            description = "Unknown session, or no N-1 run for the current state",
            content = @Content(schema = @Schema(implementation = ErrorDto.class)))
    public ContingencyReportDto contingencies(@PathParam("sessionId") String sessionId) {
        return ContingencyReportDto.from(this.sessions.contingencies(new SessionId(sessionId)));
    }

    @GET
    @Path("/n-1/{contingencyId}")
    @Operation(
            summary = "Preview one contingency",
            description =
                    "The full state under that outage, taken from the kept N-1 run without a new"
                            + " solve. Contingency ids look like branch:L2-4 or generator:G1.")
    @APIResponse(
            responseCode = "404",
            description = "Unknown session or contingency, or no N-1 run for the current state",
            content = @Content(schema = @Schema(implementation = ErrorDto.class)))
    public ContingencyPreviewDto preview(
            @PathParam("sessionId") String sessionId,
            @PathParam("contingencyId") String contingencyId) {
        return ContingencyPreviewDto.from(
                this.sessions.preview(new SessionId(sessionId), contingencyId));
    }

    @POST
    @Path("/cascade")
    @Consumes(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Run the cascade simulation",
            description =
                    "Educational simplification. Starts with the trigger outage, then trips the"
                            + " worst branch above the threshold until stable or dark. Every step"
                            + " carries a full state for replay.")
    @APIResponse(
            responseCode = "400",
            description = "Unknown trigger or option out of range",
            content = @Content(schema = @Schema(implementation = ErrorDto.class)))
    public CascadeDto runCascade(
            @PathParam("sessionId") String sessionId, @NotNull @Valid Requests.RunCascade request) {
        return CascadeDto.from(
                this.sessions.runCascade(
                        new SessionId(sessionId),
                        request.trigger(),
                        request.tripThreshold(),
                        request.maxSteps()));
    }

    @GET
    @Path("/cascade")
    @Operation(summary = "Read the kept cascade result for the current state")
    @APIResponse(
            responseCode = "404",
            description = "Unknown session, or no cascade run for the current state",
            content = @Content(schema = @Schema(implementation = ErrorDto.class)))
    public CascadeDto cascade(@PathParam("sessionId") String sessionId) {
        return CascadeDto.from(this.sessions.cascade(new SessionId(sessionId)));
    }
}
