package com.alamin.pos.controller;

import com.alamin.pos.dto.AuthTokenResponse;
import com.alamin.pos.dto.ChangePinRequest;
import com.alamin.pos.dto.LoginRequest;
import com.alamin.pos.dto.PinVerificationRequest;
import com.alamin.pos.entity.SystemConfig;
import com.alamin.pos.exception.ValidationException;
import com.alamin.pos.repository.SystemConfigRepository;
import com.alamin.pos.security.JwtTokenProvider;
import com.alamin.pos.security.Role;
import com.alamin.pos.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final JwtTokenProvider jwtTokenProvider;
    private final AuthService authService;
    private final SystemConfigRepository systemConfigRepository;

    @Value("${app.security.owner-pin:1234}")
    private String configuredOwnerPin;

    private String getEffectiveOwnerPin() {
        return systemConfigRepository.findById("OWNER_PIN")
                .map(SystemConfig::getConfigValue)
                .filter(val -> !val.trim().isEmpty())
                .orElse(configuredOwnerPin.trim());
    }

    @PostMapping("/login")
    public ResponseEntity<AuthTokenResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/verify-pin")
    public ResponseEntity<AuthTokenResponse> verifyPin(@Valid @RequestBody PinVerificationRequest request) {
        String activePin = getEffectiveOwnerPin();
        if (request.getPin() == null || !request.getPin().trim().equals(activePin)) {
            throw new ValidationException("Invalid owner PIN");
        }

        String token = jwtTokenProvider.createToken("owner", Role.ROLE_OWNER);
        return ResponseEntity.ok(AuthTokenResponse.builder()
                .token(token)
                .role(Role.ROLE_OWNER.name())
                .expiresIn(jwtTokenProvider.getValiditySeconds())
                .build());
    }

    @PostMapping("/change-pin")
    @Transactional
    public ResponseEntity<Map<String, String>> changePin(@Valid @RequestBody ChangePinRequest request) {
        String activePin = getEffectiveOwnerPin();
        if (!activePin.equals(request.getCurrentPin().trim())) {
            throw new ValidationException("Current PIN is incorrect");
        }

        if (activePin.equals(request.getNewPin().trim())) {
            throw new ValidationException("New PIN cannot be the same as the current PIN");
        }

        SystemConfig config = systemConfigRepository.findById("OWNER_PIN")
                .orElse(SystemConfig.builder().configKey("OWNER_PIN").build());
        config.setConfigValue(request.getNewPin().trim());
        systemConfigRepository.save(config);

        return ResponseEntity.ok(Map.of(
                "message", "Owner PIN updated successfully",
                "status", "SUCCESS"
        ));
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
