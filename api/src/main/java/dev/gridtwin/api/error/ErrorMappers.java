package dev.gridtwin.api.error;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.exc.MismatchedInputException;
import dev.gridtwin.api.dto.ErrorDto;
import dev.gridtwin.domain.application.TwinException;
import dev.gridtwin.domain.application.TwinFailure;
import jakarta.validation.ConstraintViolationException;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response.Status;
import java.util.Objects;
import java.util.stream.Collectors;
import org.jboss.logging.Logger;
import org.jboss.resteasy.reactive.RestResponse;
import org.jboss.resteasy.reactive.server.ServerExceptionMapper;

public class ErrorMappers {

    private static final Logger LOG = Logger.getLogger(ErrorMappers.class);
    private static final String RETRY_AFTER_SECONDS = "60";

    @ServerExceptionMapper
    public RestResponse<ErrorDto> twinFailure(TwinException exception) {
        TwinFailure failure = exception.failure();
        RestResponse.ResponseBuilder<ErrorDto> response =
                RestResponse.ResponseBuilder.create(statusOf(failure), ErrorDto.from(failure));
        if (failure instanceof TwinFailure.SessionLimitReached) {
            response.header("Retry-After", RETRY_AFTER_SECONDS);
        }
        return response.build();
    }

    @ServerExceptionMapper
    public RestResponse<ErrorDto> unreadableBody(JsonProcessingException exception) {
        return RestResponse.status(
                Status.BAD_REQUEST,
                ErrorDto.of("INVALID_INPUT", "The request body is not valid JSON for this call."));
    }

    @ServerExceptionMapper
    public RestResponse<ErrorDto> mismatchedBody(MismatchedInputException exception) {
        String field =
                exception.getPath().stream()
                        .map(JsonMappingException.Reference::getFieldName)
                        .filter(Objects::nonNull)
                        .collect(Collectors.joining("."));
        return RestResponse.status(
                Status.BAD_REQUEST,
                ErrorDto.of(
                        "INVALID_INPUT",
                        field.isEmpty()
                                ? "The request body does not match the expected shape."
                                : field + ": the value does not match the expected type."));
    }

    @ServerExceptionMapper
    public RestResponse<ErrorDto> invalidBean(ConstraintViolationException exception) {
        String reason =
                exception.getConstraintViolations().stream()
                        .map(
                                violation ->
                                        lastSegment(violation.getPropertyPath().toString())
                                                + " "
                                                + violation.getMessage())
                        .sorted()
                        .collect(Collectors.joining(", "));
        return RestResponse.status(Status.BAD_REQUEST, ErrorDto.of("INVALID_INPUT", reason));
    }

    @ServerExceptionMapper
    public RestResponse<ErrorDto> webFailure(WebApplicationException exception) {
        int status = exception.getResponse().getStatus();
        if (status >= Status.INTERNAL_SERVER_ERROR.getStatusCode()) {
            return this.unexpected(exception);
        }
        return RestResponse.status(
                Status.fromStatusCode(status),
                ErrorDto.of("HTTP_" + status, Status.fromStatusCode(status).getReasonPhrase()));
    }

    @ServerExceptionMapper
    public RestResponse<ErrorDto> unexpected(Throwable exception) {
        LOG.error("unexpected failure", exception);
        return RestResponse.status(
                Status.INTERNAL_SERVER_ERROR,
                ErrorDto.of("INTERNAL_ERROR", "The server could not complete the request."));
    }

    static Status statusOf(TwinFailure failure) {
        return switch (failure) {
            case TwinFailure.UnknownSession ignored -> Status.NOT_FOUND;
            case TwinFailure.UnknownCase ignored -> Status.NOT_FOUND;
            case TwinFailure.UnknownSwitch ignored -> Status.NOT_FOUND;
            case TwinFailure.UnknownContingency ignored -> Status.NOT_FOUND;
            case TwinFailure.NoContingencyResult ignored -> Status.NOT_FOUND;
            case TwinFailure.NoCascadeResult ignored -> Status.NOT_FOUND;
            case TwinFailure.OperationRefused ignored -> Status.CONFLICT;
            case TwinFailure.InvalidInput ignored -> Status.BAD_REQUEST;
            case TwinFailure.SessionLimitReached ignored -> Status.TOO_MANY_REQUESTS;
        };
    }

    private static String lastSegment(String path) {
        return path.substring(path.lastIndexOf('.') + 1);
    }
}
