package com.alamin.pos.controller;

import com.alamin.pos.dto.AuthTokenResponse;
import com.alamin.pos.dto.PinVerificationRequest;
import com.alamin.pos.exception.ValidationException;
import com.alamin.pos.security.JwtTokenProvider;
import com.alamin.pos.security.Role;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final JwtTokenProvider jwtTokenProvider;

    @Value("${app.security.owner-pin:1234}")
    private String configuredOwnerPin;

    @PostMapping("/verify-pin")
    public ResponseEntity<AuthTokenResponse> verifyPin(@Valid @RequestBody PinVerificationRequest request) {
        if (request.getPin() == null || !request.getPin().trim().equals(configuredOwnerPin.trim())) {
            throw new ValidationException("Invalid owner PIN");
        }

        String token = jwtTokenProvider.createToken("owner", Role.ROLE_OWNER);
        return ResponseEntity.ok(AuthTokenResponse.builder()
                .token(token)
                .role(Role.ROLE_OWNER.name())
                .expiresIn(jwtTokenProvider.getValiditySeconds())
                .build());
    }

    @PostMapping("/cashier-session")
    public ResponseEntity<AuthTokenResponse> cashierSession() {
        String token = jwtTokenProvider.createToken("cashier", Role.ROLE_CASHIER);
        return ResponseEntity.ok(AuthTokenResponse.builder()
                .token(token)
                .role(Role.ROLE_CASHIER.name())
                .expiresIn(jwtTokenProvider.getValiditySeconds())
                .build());
    }
}
