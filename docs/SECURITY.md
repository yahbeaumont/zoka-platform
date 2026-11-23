# Security and privacy model

This document describes the security posture of Zoka at the level of design. It intentionally omits exploit-relevant detail, internal endpoints and configuration.

## 1. What is being protected

| Asset | Why it matters |
|---|---|
| Student identity and contact data | Audience includes minors; exposure has legal and personal consequences |
| Private community content | Messages, direct messages and study material belong to their authors |
| Payment and entitlement state | Direct financial impact and fraud surface |
| AI provider credentials | Abuse would be billed to the platform |
| Moderation records | Restricted; contain excerpts and identities |

## 2. Trust boundaries

1. **Browser to application.** Untrusted input, including headers and cookies. Every value is validated server-side.
2. **Application to identity provider.** A Firebase ID token is verified, never trusted as decoded JSON.
3. **Application to persistence.** The Admin SDK bypasses Firestore rules, so the application is the authorisation authority and the rules are a second, independent boundary.
4. **Application to external providers.** Outbound only, with credentials held in a managed secret store and never sent to the client.
5. **Application to payment provider.** Inbound webhooks are untrusted until the signature is verified over the raw body.

## 3. Threats considered

- **Credential theft through script injection.** Mitigated by an HttpOnly session cookie, so scripts cannot read the session, and CSRF tokens on state-changing requests.
- **Privilege escalation through stale tokens.** Mitigated by deriving entitlement from subscription state on every protected operation and treating claims as a cache.
- **Quota bypass and cost abuse.** Mitigated by server-side reservation, per-user hourly windows and daily quotas, all evaluated before the provider call.
- **Prompt injection against the tutor.** Mitigated by input classification, instruction isolation and output sanitisation. Residual risk remains and is documented as such.
- **Cross-tenant data access.** Mitigated by resolving membership and role in the service layer before any read, and by rules closed by default.
- **Webhook forgery and replay.** Mitigated by signature verification over the raw body, event deduplication and idempotent application.
- **Account takeover through identity linking.** Mitigated by refusing automatic merges and requiring proof of the existing credential before linking.
- **Sensitive data in logs.** Mitigated by logging identifiers and codes rather than payloads, and by never logging provider response bodies.

## 4. Controls implemented

**Session.** Opaque session cookie, HttpOnly, Secure, SameSite. Server-side revocation on logout. CSRF token validated on mutations.

**Identity.** Passwords handled by the identity provider. CPF stored only as a salted hash for equality and an HMAC for server-side lookup, with the HMAC key kept out of the client. Verified e-mail required before protected areas.

**Authorization.** Every protected route resolves actor, resource and role. Firestore rules duplicate the check. Administrative operations require the role claim and a server-side re-check, not only a hidden button.

**Payments.** Hosted checkout, so card data never reaches the platform. Prices are validated against a server-side catalogue before entitlement is granted. Webhooks are verified and deduplicated.

**AI.** Provider keys exist only in the server runtime. Requests are normalised; responses are sanitised; policy blocks are mapped to a distinct client error so the interface can preserve the draft and explain that quota was not consumed.

**Telemetry.** Analytics is injected only after explicit consent, with anonymised paths and no identifiers. Product metrics are aggregate.

**Secrets.** Bound by reference from a managed secret store at runtime. No secret is committed, logged, returned to the client or written to a report.

## 5. What is not claimed

This repository does not assert legal compliance, certification, penetration-test results or absolute security. The product applies data minimisation, consent gating and moderation because the audience requires it, but the legal assessment of lawful basis, parental consent and retention sits outside the code and outside this document. Minors' data handling is a product requirement, not a solved compliance problem.

The tutor's filters reduce the risk of prompt injection and unsafe output. They do not eliminate it, and the product tells users not to share personal data in the conversation.

## 6. Reporting

Security issues should be reported privately to the maintainer through the contact in the GitHub profile. Please do not open a public issue for a suspected vulnerability.
