# Decisions

Seven decisions that shaped Zoka. Each record states the context, the choice, the alternatives that were considered and the consequences that followed.

---

## ADR-001: One Next.js runtime instead of a separate API service

**Context.** The product needed server-rendered public pages, authenticated application screens, and an API for the client. A separate API service would mean two deployables, two authentication paths and a network hop for every authenticated render.

**Decision.** A single Next.js application hosts pages, route handlers and background handlers. Server components read data directly through the service layer; the browser talks to route handlers only.

**Alternatives.** A NestJS or Fastify API behind the front end; a serverless function per endpoint.

**Consequences.** One deployment, one authorisation path, no duplicated DTOs. The cost is that long-running work shares a process with request traffic, so anything heavy must be bounded or scheduled. A future split is possible along the service layer, which is already isolated from the transport.

---

## ADR-002: Firebase for identity and persistence, with rules as a second boundary

**Context.** The team is small, the audience is regional, and the product needs managed authentication with e-mail, CPF and Google, plus document persistence with per-tenant isolation.

**Decision.** Firebase Auth for identity and Firestore in a São Paulo region for persistence. The browser never queries Firestore directly; all access goes through route handlers. Security rules remain enabled and closed by default, duplicating the server-side checks.

**Alternatives.** PostgreSQL with an ORM and a self-managed auth stack; a document store without managed auth.

**Consequences.** No database operations, regional data residency, and identity providers handled for free. Firestore is not relational, so aggregates are denormalised and read models are maintained explicitly. Because the Admin SDK bypasses rules, the rules are a safety net, not the primary control, and both layers must be kept consistent.

---

## ADR-003: Exchange the Firebase token for an HttpOnly session cookie

**Context.** Firebase clients normally hold tokens in the browser. That exposes credentials to any script on the page and makes server-side revocation awkward.

**Decision.** The server exchanges a verified Firebase ID token for an opaque session in an HttpOnly, Secure, SameSite cookie. Custom claims carry role and plan as a cache. CSRF tokens are required on state-changing requests.

**Alternatives.** Client-held ID tokens with refresh; a third-party session library.

**Consequences.** Scripts cannot read the session, and logout revokes server-side. The exchange adds a round trip at login and requires the server to re-validate the session on every request, which is the intended cost.

---

## ADR-004: Quota reservation and settlement instead of a counter

**Context.** Tutoring has a marginal cost per generation. A counter incremented before the provider call charges users for failures; a counter incremented after allows parallel requests to overspend.

**Decision.** Reserve a slot in a transaction before opening the stream, then settle or roll back. Settlement is idempotent, keyed by message. Failed generations restore the daily quota but still count in the hourly anti-abuse window.

**Alternatives.** Optimistic counting with periodic reconciliation; hard daily cut-off with no refunds.

**Consequences.** Correct under concurrency and retries, at the price of a short-lived reservation state that needs expiry handling. Orphaned reservations are released by a scheduled sweep.

---

## ADR-005: Entitlement derived from subscription state, claims as cache only

**Context.** Plan checks were initially read from a client-visible claim, which meant a stale token could grant paid features.

**Decision.** Every protected operation resolves entitlement from the current subscription or grant record. Claims are synchronised afterwards for UI purposes. When they disagree, the record wins.

**Alternatives.** Trust claims and refresh aggressively; store an entitlement flag updated by webhook only.

**Consequences.** A stale claim cannot escalate access. The cost is one extra read on protected paths, mitigated by short-lived caching keyed by user and version.

---

## ADR-006: A server-side AI proxy, with provider choice kept operational

**Context.** Multiple providers were evaluated. Hard-coding one would couple pricing and reliability to a single vendor, and calling providers from the browser would expose keys.

**Decision.** All inference goes through a proxy that normalises requests, classifies intent, enforces quotas, streams typed events and maps provider failures to a small taxonomy. Provider selection is configuration.

**Alternatives.** Direct provider SDK in the browser with restricted keys; a managed AI gateway.

**Consequences.** Keys stay server-side, failures are uniform, and providers can change without touching the client. The proxy becomes a single point of failure for tutoring, and its error taxonomy has to be maintained as providers change their contracts.

---

## ADR-007: Consent-gated analytics and data minimisation by default

**Context.** The audience includes minors, and the product needs usage data to improve. Default analytics would collect more than necessary and would be indefensible in a conversation with a parent.

**Decision.** Analytics is injected only after explicit consent, and refusal is a valid permanent state. Page views use a fixed title and anonymised path; queries and identifiers are stripped. Product decisions are made from aggregate counts, not from user-level tracking.

**Alternatives.** Default-on analytics with an opt-out; server-side analytics with no client script.

**Consequences.** Conversion data is incomplete by design, and some experiments cannot be measured. That was accepted: the alternative is collecting data from minors without a defensible basis.
