package com.alamin.pos.security;

import com.alamin.pos.entity.IdempotencyRecord;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingResponseWrapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Optional;

@Slf4j
@Component
@RequiredArgsConstructor
public class IdempotencyFilter extends OncePerRequestFilter {

    private final IdempotencyService idempotencyService;

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {

        String key = request.getHeader("X-Idempotency-Key");
        if (key == null || key.isBlank() || !isApplicableMethod(request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }

        key = key.trim();
        Optional<IdempotencyRecord> existing = idempotencyService.findRecord(key);

        if (existing.isPresent()) {
            IdempotencyRecord record = existing.get();
            if ("COMPLETED".equalsIgnoreCase(record.getStatus())) {
                log.info("Replaying cached idempotent response for key: {}", key);
                response.setStatus(record.getResponseCode() != null ? record.getResponseCode() : HttpServletResponse.SC_OK);
                response.setContentType("application/json;charset=UTF-8");
                response.setHeader("X-Idempotency-Replayed", "true");
                if (record.getResponseBody() != null) {
                    response.getOutputStream().write(record.getResponseBody().getBytes(StandardCharsets.UTF_8));
                }
                return;
            } else if ("IN_PROGRESS".equalsIgnoreCase(record.getStatus())) {
                log.warn("Concurrent request with in-progress idempotency key: {}", key);
                response.setStatus(HttpServletResponse.SC_CONFLICT);
                response.setContentType("application/json;charset=UTF-8");
                response.getOutputStream().write(
                        "{\"status\":409,\"errorCode\":\"IDEMPOTENCY_CONFLICT\",\"message\":\"A request with this idempotency key is currently processing. Please wait.\"}"
                                .getBytes(StandardCharsets.UTF_8));
                return;
            }
        }

        boolean started = idempotencyService.startExecution(key);
        if (!started) {
            response.setStatus(HttpServletResponse.SC_CONFLICT);
            response.setContentType("application/json;charset=UTF-8");
            response.getOutputStream().write(
                    "{\"status\":409,\"errorCode\":\"IDEMPOTENCY_CONFLICT\",\"message\":\"A request with this idempotency key is currently processing. Please wait.\"}"
                            .getBytes(StandardCharsets.UTF_8));
            return;
        }

        ContentCachingResponseWrapper responseWrapper = new ContentCachingResponseWrapper(response);
        try {
            filterChain.doFilter(request, responseWrapper);
            int statusCode = responseWrapper.getStatus();
            byte[] content = responseWrapper.getContentAsByteArray();
            String responseBody = new String(content, StandardCharsets.UTF_8);

            if (statusCode >= 200 && statusCode < 300) {
                idempotencyService.complete(key, statusCode, responseBody);
            } else {
                idempotencyService.remove(key);
            }
        } catch (Exception ex) {
            idempotencyService.remove(key);
            throw ex;
        } finally {
            responseWrapper.copyBodyToResponse();
        }
    }

    private boolean isApplicableMethod(String method) {
        return "POST".equalsIgnoreCase(method) || "PUT".equalsIgnoreCase(method) || "PATCH".equalsIgnoreCase(method);
    }
}
