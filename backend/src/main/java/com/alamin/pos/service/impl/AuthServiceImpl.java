package com.alamin.pos.service.impl;

import com.alamin.pos.dto.AuthTokenResponse;
import com.alamin.pos.dto.LoginRequest;
import com.alamin.pos.entity.AppUser;
import com.alamin.pos.exception.InvalidCredentialsException;
import com.alamin.pos.repository.AppUserRepository;
import com.alamin.pos.security.JwtTokenProvider;
import com.alamin.pos.security.Role;
import com.alamin.pos.service.AuthService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final AppUserRepository appUserRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    @Override
    @Transactional
    public AuthTokenResponse login(LoginRequest request) {
        AppUser user = appUserRepository.findByUsernameIgnoreCase(request.getUsername().trim())
                .orElseThrow(() -> {
                    log.warn("Login attempt for unknown username: {}", request.getUsername());
                    return new InvalidCredentialsException("Invalid username or password");
                });

        if (!user.isActive()) {
            log.warn("Login attempt for deactivated account: {}", user.getUsername());
            throw new InvalidCredentialsException("This account has been deactivated");
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            log.warn("Login attempt with wrong password for username: {}", user.getUsername());
            throw new InvalidCredentialsException("Invalid username or password");
        }

        user.setLastLoginAt(LocalDateTime.now());

        String token = jwtTokenProvider.createToken(user.getUsername(), Role.ROLE_OWNER);

        return AuthTokenResponse.builder()
                .token(token)
                .role(Role.ROLE_OWNER.name())
                .expiresIn(jwtTokenProvider.getValiditySeconds())
                .username(user.getUsername())
                .fullName(user.getFullName())
                .build();
    }
}
