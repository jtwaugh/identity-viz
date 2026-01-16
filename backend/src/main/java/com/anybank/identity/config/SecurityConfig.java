package com.anybank.identity.config;

import com.anybank.identity.security.AuditLoggingFilter;
import com.anybank.identity.security.BffSessionAuthFilter;
import com.anybank.identity.security.CorrelationIdFilter;
import com.anybank.identity.security.PolicyEnforcementFilter;
import com.anybank.identity.security.RiskEvaluationFilter;
import com.anybank.identity.security.TenantContextFilter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Slf4j
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final CorrelationIdFilter correlationIdFilter;
    private final BffSessionAuthFilter bffSessionAuthFilter;
    private final TenantContextFilter tenantContextFilter;
    private final RiskEvaluationFilter riskEvaluationFilter;
    private final PolicyEnforcementFilter policyEnforcementFilter;
    private final AuditLoggingFilter auditLoggingFilter;

    @Value("${spring.security.oauth2.resourceserver.jwt.jwk-set-uri}")
    private String jwkSetUri;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf.disable())
            // Use IF_REQUIRED for sessions - allows BFF pattern with session-based auth
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
            .authorizeHttpRequests(authz -> authz
                .requestMatchers("/actuator/**").permitAll()
                .requestMatchers("/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**").permitAll()
                .requestMatchers("/debug/**").permitAll()
                .requestMatchers("/bff/auth/**").permitAll()  // BFF auth endpoints
                .requestMatchers("/error").permitAll()
                .anyRequest().authenticated()
            )
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt
                    .decoder(jwtDecoder())
                    .jwtAuthenticationConverter(jwtAuthenticationConverter()))
            )
            .addFilterBefore(correlationIdFilter, UsernamePasswordAuthenticationFilter.class)
            // BffSessionAuthFilter runs before JWT filter to enable session-based auth
            .addFilterBefore(bffSessionAuthFilter, org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter.class)
            // TenantContextFilter must run AFTER BearerTokenAuthenticationFilter so JWT is processed
            .addFilterAfter(tenantContextFilter, org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter.class)
            .addFilterAfter(riskEvaluationFilter, TenantContextFilter.class)
            .addFilterAfter(policyEnforcementFilter, RiskEvaluationFilter.class)
            .addFilterAfter(auditLoggingFilter, PolicyEnforcementFilter.class);

        return http.build();
    }

    @Bean
    public JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtGrantedAuthoritiesConverter grantedAuthoritiesConverter = new JwtGrantedAuthoritiesConverter();
        grantedAuthoritiesConverter.setAuthoritiesClaimName("roles");
        grantedAuthoritiesConverter.setAuthorityPrefix("ROLE_");

        JwtAuthenticationConverter jwtConverter = new JwtAuthenticationConverter();
        jwtConverter.setJwtGrantedAuthoritiesConverter(grantedAuthoritiesConverter);
        return jwtConverter;
    }

    @Bean
    public JwtDecoder jwtDecoder() {
        // Use explicit JWK URI to avoid issuer-based URL derivation
        // This is necessary because tokens are issued with localhost:8080 issuer
        // but the backend must fetch JWKs from keycloak:8080 within Docker network
        log.info("Creating JwtDecoder with JWK Set URI: {}", jwkSetUri);
        return NimbusJwtDecoder.withJwkSetUri(jwkSetUri).build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(List.of(
                "http://localhost:3000",
                "http://localhost:8080",
                "https://app.anybank.com"
        ));
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList(
                "Authorization",
                "Content-Type",
                "X-Requested-With",
                "Accept",
                "Origin",
                "X-Tenant-ID",
                "X-Correlation-ID",
                "X-Session-ID",
                "X-Request-Source"
        ));
        configuration.setExposedHeaders(List.of("Authorization", "X-Correlation-ID"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
