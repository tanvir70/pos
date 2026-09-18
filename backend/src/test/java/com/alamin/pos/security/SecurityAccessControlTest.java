package com.alamin.pos.security;

import com.alamin.pos.dto.PinVerificationRequest;
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

import static org.hamcrest.Matchers.*;
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
    @DisplayName("1. Unauthenticated request to /api/backup/download returns 401 Unauthorized")
    void testUnauthenticatedBackupAccessDenied() throws Exception {
        mockMvc.perform(get("/api/backup/download"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value("UNAUTHORIZED"));
    }

    @Test
    @DisplayName("2. Unauthenticated request to /api/dashboard/summary returns 401 Unauthorized")
    void testUnauthenticatedDashboardAccessDenied() throws Exception {
        mockMvc.perform(get("/api/dashboard/summary"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value("UNAUTHORIZED"));
    }

    @Test
    @DisplayName("3. Unauthenticated request to POST /api/products returns 401 Unauthorized")
    void testUnauthenticatedProductCreationDenied() throws Exception {
        ProductDto dto = ProductDto.builder()
                .productCode("TEST-UNAUTH-01")
                .nameEn("Unauthorized Product")
                .nameBn("অননুমোদিত পণ্য")
                .category("INSECTICIDE")
                .baseUnit("KG")
                .cartonMultiplier(BigDecimal.ONE)
                .standardRetailPrice(new BigDecimal("500.00"))
                .standardWholesalePrice(new BigDecimal("450.00"))
                .build();

        mockMvc.perform(post("/api/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("4. Public auth: POST /api/auth/cashier-session returns 200 OK and valid JWT")
    void testCashierSessionIssuance() throws Exception {
        mockMvc.perform(post("/api/auth/cashier-session"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.role").value("ROLE_CASHIER"))
                .andExpect(jsonPath("$.expiresIn").isNumber());
    }

    @Test
    @DisplayName("5. PIN Verification: Valid PIN 1234 returns 200 OK and ROLE_OWNER JWT")
    void testValidPinVerification() throws Exception {
        PinVerificationRequest request = PinVerificationRequest.builder()
                .pin("1234")
                .build();

        mockMvc.perform(post("/api/auth/verify-pin")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.role").value("ROLE_OWNER"));
    }

    @Test
    @DisplayName("6. PIN Verification: Invalid PIN returns 400 Bad Request")
    void testInvalidPinVerification() throws Exception {
        PinVerificationRequest request = PinVerificationRequest.builder()
                .pin("9999")
                .build();

        mockMvc.perform(post("/api/auth/verify-pin")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("Invalid owner PIN")));
    }

    @Test
    @DisplayName("6a. Change PIN: Change PIN with valid current PIN and verify with new PIN")
    void testChangeOwnerPin() throws Exception {
        com.alamin.pos.dto.ChangePinRequest changeRequest = com.alamin.pos.dto.ChangePinRequest.builder()
                .currentPin("1234")
                .newPin("5678")
                .build();

        mockMvc.perform(post("/api/auth/change-pin")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(changeRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"));

        PinVerificationRequest verifyNew = PinVerificationRequest.builder()
                .pin("5678")
                .build();
        mockMvc.perform(post("/api/auth/verify-pin")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(verifyNew)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("ROLE_OWNER"));

        com.alamin.pos.dto.ChangePinRequest restoreRequest = com.alamin.pos.dto.ChangePinRequest.builder()
                .currentPin("5678")
                .newPin("1234")
                .build();
        mockMvc.perform(post("/api/auth/change-pin")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(restoreRequest)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("6b. Change PIN: Invalid current PIN returns 400 Bad Request")
    void testChangeOwnerPinInvalidCurrent() throws Exception {
        com.alamin.pos.dto.ChangePinRequest changeRequest = com.alamin.pos.dto.ChangePinRequest.builder()
                .currentPin("0000")
                .newPin("5678")
                .build();

        mockMvc.perform(post("/api/auth/change-pin")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(changeRequest)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("Current PIN is incorrect")));
    }

    @Test
    @WithMockUser(roles = "CASHIER")
    @DisplayName("7. Cashier role: Access to /api/backup/download returns 403 Forbidden")
    void testCashierCannotDownloadBackup() throws Exception {
        mockMvc.perform(get("/api/backup/download"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("FORBIDDEN"));
    }

    @Test
    @WithMockUser(roles = "CASHIER")
    @DisplayName("8. Cashier role: Access to /api/dashboard/summary returns 403 Forbidden")
    void testCashierCannotAccessDashboardSummary() throws Exception {
        mockMvc.perform(get("/api/dashboard/summary"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("FORBIDDEN"));
    }

    @Test
    @WithMockUser(roles = "CASHIER")
    @DisplayName("9. Cashier role: POST /api/products returns 403 Forbidden")
    void testCashierCannotCreateProduct() throws Exception {
        ProductDto dto = ProductDto.builder()
                .productCode("TEST-CASHIER-01")
                .nameEn("Cashier Product")
                .nameBn("ক্যাশিয়ার পণ্য")
                .category("INSECTICIDE")
                .baseUnit("KG")
                .cartonMultiplier(BigDecimal.ONE)
                .standardRetailPrice(new BigDecimal("500.00"))
                .standardWholesalePrice(new BigDecimal("450.00"))
                .build();

        mockMvc.perform(post("/api/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "OWNER")
    @DisplayName("10. Owner role: Access to /api/dashboard/summary returns 200 OK")
    void testOwnerCanAccessDashboardSummary() throws Exception {
        mockMvc.perform(get("/api/dashboard/summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalMarketDue").isNumber())
                .andExpect(jsonPath("$.cashInDrawerToday").isNumber());
    }

    @Test
    @DisplayName("11. Direct X-Owner-PIN header grants ROLE_OWNER access without Bearer token")
    void testDirectOwnerPinHeaderAccess() throws Exception {
        mockMvc.perform(get("/api/dashboard/summary")
                        .header("X-Owner-PIN", "1234"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalMarketDue").isNumber());
    }

    @Test
    @DisplayName("12. Bearer JWT token header grants authenticated access")
    void testBearerTokenAuthentication() throws Exception {
        String ownerToken = jwtTokenProvider.createToken("owner", Role.ROLE_OWNER);

        mockMvc.perform(get("/api/dashboard/summary")
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalMarketDue").isNumber());
    }

    @Test
    @WithMockUser(roles = "CASHIER")
    @DisplayName("13. Cost Masking: Cashier viewing /api/inventory/stock has purchaseCost masked (null)")
    void testCostMaskingForCashier() throws Exception {
        mockMvc.perform(get("/api/inventory/stock"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", not(empty())))
                .andExpect(jsonPath("$[0].purchaseCost").value(nullValue()));
    }

    @Test
    @WithMockUser(roles = "OWNER")
    @DisplayName("14. Cost Masking: Owner viewing /api/inventory/stock can view purchaseCost")
    void testCostVisibleForOwner() throws Exception {
        mockMvc.perform(get("/api/inventory/stock"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", not(empty())))
                .andExpect(jsonPath("$[0].purchaseCost").value(notNullValue()));
    }

    @Test
    @DisplayName("15. Public Barcode Access: /api/barcode/{barcode} allows unauthenticated requests")
    void testPublicBarcodeAccess() throws Exception {
        mockMvc.perform(get("/api/barcode/8901234567890"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "image/png"));
    }
}
