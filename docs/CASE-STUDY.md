# Case study: building a study platform where the AI has to pay for itself

## The starting point

Zoka began with a simple observation: Brazilian students already study together, but the tools they use were not built for studying. WhatsApp groups fill with PDFs and unanswered questions. Video libraries are passive. Generic chatbots answer confidently and wrongly, with no academic context and no cost control.

The product I wanted was narrower than a social network and more demanding than a chatbot: a place where a student joins a group, finds the channel for their subject, and asks a question that gets an answer with sources, inside a plan they pay for, without the platform losing money on every message.

Three constraints defined the work. The audience includes minors, so data handling had to be defensible before the first user arrived. AI inference has a marginal cost, so the business model had to be enforced in code, not in a policy document. And the team was one engineer, which meant every component had to be operable by one person at 2 am.

## What was built

The platform has four layers that had to agree with each other.

**Identity.** E-mail, tax ID (CPF) and Google sign-in resolving to one account, with a session the browser cannot read, and role and plan projected as claims for the interface only.

**Community.** Groups with channels, direct messages, membership approval, owner and moderator roles, a school hub derived from an e-mail domain, and moderation that runs on a queue rather than in the request path.

**Tutoring.** A proxy that classifies intent, decides whether the question needs a web search, reserves quota, streams the answer, filters prompt injection and sanitises output.

**Commerce.** Subscriptions with monthly and annual periods, a family plan with dependants, and a separate sponsorship flow that issues redeemable vouchers instead of inventing subscriptions.

Each layer is unremarkable alone. The difficulty was in the seams: quota and failure, identity and linking, moderation and privacy, entitlement and caching.

## The hard parts

### A quota that is correct when everything goes wrong

My first implementation incremented a counter before calling the provider. Within a week of real use, two problems appeared. A provider timeout consumed a student's daily quota for an answer they never received. And two tabs sending at the same time could both pass the check, producing three answers against a limit of five.

The redesign separated the decision from the effect. A transaction reserves a slot and registers the attempt. The stream opens. If the first token never arrives, the reservation is rolled back and the daily quota is restored, while the attempt remains counted in the hourly anti-abuse window, because the attempt did cost something. Settlement is keyed by message id, so a retried request cannot settle twice.

The subtle part is the orphan. A process that dies between reservation and settlement leaves a slot held by nothing. A scheduled sweep releases expired reservations. This is the kind of state that a simple counter never has, and it is the price of correctness.

### Linking a Google account without creating a second person

The Google flow produced duplicate accounts in an early build. A student who registered with e-mail and later pressed "continue with Google" ended up with two profiles, two plans and two histories, and the support cost was immediate.

The fix is a deliberate conflict. When the verified Google identity matches an existing e-mail under a different identifier, the server refuses to merge and returns a typed conflict. The client keeps the pending OAuth credential in memory only, asks for the existing password, authenticates the person, links the credential to that same user, and only then creates the session. No duplicate profile, no silent merge, no disclosure of whether the e-mail exists.

It is slower for the user and it is the correct behaviour. Automatic merging is how platforms lose accounts.

### Moderation that respects the room

Focus rooms are small audio and video sessions with a text chat beside them. Reading every message in real time is expensive and, more importantly, wrong: students should not feel surveilled in a study room.

The compromise was batch analysis. Ten messages are queued, analysed together, and only a positive result creates a restricted alert with the flagged excerpt. The student interface never signals that analysis happened. The family panel shows aggregate safety status, never message text.

Batching costs latency and means detection is not immediate. I accepted that, because the alternative, a real-time classifier on every message, would have changed the product into something students would not use honestly.

### The bug that came from a provider limit I had not read

The creator tier returned a server error for every request while the standard tier worked. Logs showed a provider rejection translated into an unavailable error. The payload looked valid.

The cause was a documented limit I had assumed instead of verified: the provider caps output tokens at 1200, and the creator payload asked for 1800. The standard tier asked for less, which is why only one path failed. The fix was one constant, but the lesson was structural: provider contracts are part of the system, and a proxy that hides them also hides their constraints. From then on, each provider contract is recorded with its limits and covered by a test that fails when the payload exceeds them.

## What changed along the way

The first version trusted claims for plan checks. That lasted until a stale token granted a paid feature for the length of a session. Entitlement moved to a derived read, with claims demoted to a cache.

The first version queried Firestore from the browser for community data. That was fast to build and impossible to keep safe, because every new screen needed its own rules. Moving all reads behind route handlers cost a network hop and bought a single authorisation path.

The first version modelled sponsorship as a discounted subscription. That polluted revenue reporting and renewal logic. Vouchers with an expiring grant and a distinct source fixed it, at the cost of one more concept in the domain.

## What I would do differently

I would write the provider contract tests before the first integration, not after the incident that made them necessary. I would model quotas as a first-class aggregate from the beginning instead of adding it to a counter. And I would decide the moderation model before building the room, because privacy constraints are cheap to design in and expensive to retrofit.

## Where it stands

Zoka is in production, with a test suite that runs against emulators and mocks rather than production data, and an operational model one engineer can sustain. The commercial layer, the data model and the operational configuration are not published here. The engineering approach is.
