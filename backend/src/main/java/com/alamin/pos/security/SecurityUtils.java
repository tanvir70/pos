package com.alamin.pos.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

public class SecurityUtils {

    private SecurityUtils() {}

    public static boolean isOwner() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            return false;
        }
        return auth.getAuthorities().stream()
                .anyMatch(a -> Role.ROLE_OWNER.name().equals(a.getAuthority()) || "ROLE_OWNER".equals(a.getAuthority()));
    }
}
