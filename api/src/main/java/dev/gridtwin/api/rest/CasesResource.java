package dev.gridtwin.api.rest;

import dev.gridtwin.api.adapter.CaseCatalog;
import dev.gridtwin.api.dto.CaseDetailDto;
import dev.gridtwin.api.dto.CaseSummaryDto;
import dev.gridtwin.api.dto.ErrorDto;
import dev.gridtwin.domain.application.TwinException;
import dev.gridtwin.domain.application.TwinFailure;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import java.util.List;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.media.Content;
import org.eclipse.microprofile.openapi.annotations.media.Schema;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

@Path("/api/cases")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "cases")
public class CasesResource {

    private final CaseCatalog catalog;

    @Inject
    public CasesResource(CaseCatalog catalog) {
        this.catalog = catalog;
    }

    @GET
    @Operation(summary = "List the cases that can be switched")
    public List<CaseSummaryDto> list() {
        return this.catalog.all().stream().map(CaseSummaryDto::from).toList();
    }

    @GET
    @Path("/{caseId}")
    @Operation(
            summary = "Static data of a case",
            description =
                    "Buses, branches, generators, loads, schematic layout and the substation"
                            + " description. Pushed states carry values only.")
    @APIResponse(
            responseCode = "200",
            description = "OK",
            content = @Content(schema = @Schema(implementation = CaseDetailDto.class)))
    @APIResponse(
            responseCode = "404",
            description = "Unknown case",
            content = @Content(schema = @Schema(implementation = ErrorDto.class)))
    public CaseDetailDto detail(@PathParam("caseId") String caseId) {
        return this.catalog
                .data(caseId)
                .map(CaseDetailDto::from)
                .orElseThrow(() -> new TwinException(new TwinFailure.UnknownCase(caseId)));
    }
}
