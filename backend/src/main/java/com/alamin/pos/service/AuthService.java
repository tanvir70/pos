package com.alamin.pos.service;

import com.alamin.pos.dto.AuthTokenResponse;
import com.alamin.pos.dto.LoginRequest;

public interface AuthService {

    AuthTokenResponse login(LoginRequest request);
}
