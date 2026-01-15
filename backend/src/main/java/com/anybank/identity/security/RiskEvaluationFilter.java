package com.anybank.identity.security;

import com.anybank.identity.entity.User;
import com.anybank.identity.repository.UserRepository;
import com.anybank.identity.service.RiskService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

@Component
@Order(2)
@RequiredArgsConstructor
@Slf4j
public class RiskEvaluationFilter extends OncePerRequestFilter {

    public static final String RISK_SCORE_ATTRIBUTE = "riskScore";

    private final RiskService riskService;
    private final UserRepository userRepository;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication != null && authentication.getPrincipal() instanceof Jwt jwt) {
            UUID userId = getUserId(jwt);
            int riskScore = riskService.calculateRiskScore(request, userId);
            request.setAttribute(RISK_SCORE_ATTRIBUTE, riskScore);
            log.debug("Risk score calculated: {} for request to {}", riskScore, request.getRequestURI());
        }

        filterChain.doFilter(request, response);
    }

    private UUID getUserId(Jwt jwt) {
        String externalId = jwt.getSubject();
        return userRepository.findByExternalId(externalId)
                .map(User::getId)
                .orElse(null);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path.startsWith("/actuator") ||
               path.startsWith("/swagger") ||
               path.startsWith("/v3/api-docs") ||
               path.startsWith("/auth/");
    }
}
