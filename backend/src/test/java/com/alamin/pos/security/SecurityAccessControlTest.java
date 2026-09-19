package com.alamin.pos.security;

import com.alamin.pos.dto.LoginRequest;
import com.alamin.pos.dto.ProductDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
public class SecurityAccessControlTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Test
    @DisplayName("Unauthenticated business API requests return 401 Unauthorized")
    void unauthenticatedBusinessApiDenied() throws Exception {
        mockMvc.perform(get("/api/dashboard/summary"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value("UNAUTHORIZED"));
    }

    @Test
    @DisplayName("Login returns a full-access JWT")
    void loginReturnsFullAccessJwt() throws Exception {
        LoginRequest request = LoginRequest.builder()
                .username("owner")
                .password("owner123")
                .build();

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.role").value("ROLE_OWNER"))
                .andExpect(jsonPath("$.expiresIn").isNumber());
    }

    @Test
    @WithMockUser
    @DisplayName("Authenticated users can access analytics and unmasked inventory cost")
    void authenticatedUserHasFullAccess() throws Exception {
        mockMvc.perform(get("/api/dashboard/summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalMarketDue").isNumber());

        mockMvc.perform(get("/api/inventory/stock"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", not(empty())))
                .andExpect(jsonPath("$[0].purchaseCost").value(notNullValue()));
    }

    @Test
    @WithMockUser
    @DisplayName("Authenticated users can create products")
    void authenticatedUserCanCreateProduct() throws Exception {
        ProductDto dto = ProductDto.builder()
                .productCode("TEST-FULL-ACCESS-01")
                .nameEn("Full Access Product")
                .nameBn("ফুল অ্যাক্সেস পণ্য")
                .category("INSECTICIDE")
                .baseUnit("KG")
                .cartonMultiplier(BigDecimal.ONE)
                .standardRetailPrice(new BigDecimal("500.00"))
                .standardWholesalePrice(new BigDecimal("450.00"))
                .build();

        mockMvc.perform(post("/api/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.productCode").value("TEST-FULL-ACCESS-01"));
    }

    @Test
    @DisplayName("Bearer JWT grants authenticated access")
    void bearerTokenAuthentication() throws Exception {
        String token = jwtTokenProvider.createToken("owner", Role.ROLE_OWNER);

        mockMvc.perform(get("/api/dashboard/summary")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalMarketDue").isNumber());
    }

    @Test
    @DisplayName("Barcode images remain public")
    void publicBarcodeAccess() throws Exception {
        mockMvc.perform(get("/api/barcode/8901234567890"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "image/png"));
    }
}
