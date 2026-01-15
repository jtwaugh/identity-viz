package com.anybank.identity.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Test to verify JWT configuration and property injection
 */
@SpringBootTest
@TestPropertySource(properties = {
    "spring.security.oauth2.resourceserver.jwt.jwk-set-uri=http://test-keycloak:8080/realms/anybank/protocol/openid-connect/certs",
    "spring.security.oauth2.resourceserver.jwt.issuer-uri=http://test-keycloak:8080/realms/anybank",
    "spring.datasource.url=jdbc:h2:mem:testdb",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.jpa.hibernate.ddl-auto=create-drop",
    "spring.flyway.enabled=false",
    "opa.url=http://localhost:8181/v1/data/bank/authz",
    "keycloak.url=http://test-keycloak:8080",
    "keycloak.realm=anybank",
    "keycloak.client-id=anybank-api",
    "keycloak.client-secret=test-secret"
})
class SecurityConfigTest {

    @Value("${spring.security.oauth2.resourceserver.jwt.jwk-set-uri}")
    private String jwkSetUri;

    @Autowired
    private JwtDecoder jwtDecoder;

    @Test
    void jwkSetUriPropertyShouldBeInjected() {
        System.out.println("=== JWK Set URI Property Test ===");
        System.out.println("Injected JWK Set URI: " + jwkSetUri);

        assertNotNull(jwkSetUri, "JWK Set URI should not be null");
        assertEquals("http://test-keycloak:8080/realms/anybank/protocol/openid-connect/certs", jwkSetUri);
        assertFalse(jwkSetUri.contains("localhost"), "JWK Set URI should NOT contain localhost");
    }

    @Test
    void jwtDecoderBeanShouldBeCreated() {
        System.out.println("=== JwtDecoder Bean Test ===");
        System.out.println("JwtDecoder class: " + jwtDecoder.getClass().getName());

        assertNotNull(jwtDecoder, "JwtDecoder bean should be created");
    }

    @Test
    void jwtDecoderShouldUseConfiguredUri() {
        // This test verifies that when we try to decode a token,
        // it attempts to fetch from the configured URI, not localhost
        System.out.println("=== JwtDecoder URI Test ===");

        String testToken = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0In0.fake";

        try {
            jwtDecoder.decode(testToken);
            fail("Should have thrown an exception trying to fetch JWKs");
        } catch (Exception e) {
            String message = e.getMessage();
            System.out.println("Exception message: " + message);

            // The error message should reference our configured URL, not localhost
            if (message != null && message.contains("localhost:8080")) {
                fail("JwtDecoder is still trying to use localhost:8080! Message: " + message);
            }

            // We expect it to fail trying to reach test-keycloak (which doesn't exist)
            // but the important thing is it's NOT trying to reach localhost
            assertTrue(
                message == null || !message.contains("localhost:8080"),
                "JwtDecoder should not be trying to reach localhost:8080"
            );
        }
    }
}
