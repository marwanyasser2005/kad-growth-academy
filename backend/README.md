# Future connected edition: implementation contract

**Status: design handoff only. No backend, database migration, authentication, or central synchronization
has been deployed or connected in Open Edition 1.0.0.**

The existing login, registration, reset, manager, and administrative screens establish visual and workflow structure.
They intentionally do not collect credentials or pretend that a database exists.

## Target boundaries

| Boundary | Required behavior before activation |
|---|---|
| Identity | Verified organization membership and server-issued sessions |
| Authorization | Server-enforced organization, department, and role scoping |
| Employee data | Private-by-default notes, minimal profile data, explicit retention |
| Grading | Server-side answer keys and validated submissions |
| Evidence | Versioned lesson IDs, timestamps, idempotency, and source of record |
| Reviews | Identified authorized reviewer, decision, rationale, immutable audit entry |
| Certificates | Server eligibility calculation and signed, revocable verification record |
| Content | Draft/reviewed/published/archived lifecycle with authorized publication |
| Reliability | Tested backups/restore, monitoring, rate limits, incident procedures |

Do not promote a role supplied in localStorage into a trusted account role.
Do not import a local best score as a verified exam result.
Local import can populate a separate `self_reported_legacy` record after user consent,
but it must not grant an institutional badge or server-side mastery.

## Suggested entities

`organizations`, `departments`, `profiles`, `memberships`, `manager_assignments`,
`tracks`, `modules`, `lessons`, `resource_reviews`, `question_versions`,
`private_answer_keys`, `assignments`, `learning_events`, `quiz_attempts`,
`practice_submissions`, `manager_reviews`, `private_notes`, `capstones`,
`credential_records`, `support_tickets`, `audit_events`.

Each employee-owned entity needs an organization boundary as well as a user boundary.
Managers must be restricted to an explicit assigned team, not all users with a matching department string.
Private personal reflections should not be exposed automatically to managers.

## API contract to implement later

| Method | Route | Requirement |
|---|---|---|
| GET | /api/catalog | Published content only; no answer keys |
| GET | /api/me | Verified session identity |
| GET/PUT | /api/me/preferences | Owner-only fields; version/conflict handling |
| POST | /api/learning/events | Idempotency key, versioned lesson ID, bounded payload |
| POST | /api/quizzes/:id/attempts | Server grades a known question version |
| POST | /api/practices/:id/submissions | Authenticated owner and sanitized bounded text |
| POST | /api/reviews/:submissionId | Assigned reviewer role, immutable review log |
| GET | /api/manager/team | Assigned users only, privacy-filtered metrics |
| POST | /api/admin/content/:id/publish | Authorized editor, all publication gates met |
| POST | /api/credentials/issue | Server eligibility, immutable signed record |
| POST | /api/privacy/export | Authenticated data subject |
| DELETE | /api/privacy/me | Documented retention/deletion workflow |

These endpoints do not exist in the delivered open app; the table is not an API availability claim.

## Supabase option

Supabase Auth/PostgreSQL could implement the connected edition; it is not a current dependency.
Row Level Security documentation:
https://supabase.com/docs/guides/database/postgres/row-level-security

Before using a public data API, enable/test RLS on every exposed table and protect privileged role changes.
Keep service-role credentials on the server only. Keep answer keys out of anonymous/public selects.
Test cross-user, cross-team, and cross-organization access with negative cases.
A migration should be authored against the selected deployed database version and reviewed before execution;
this package deliberately does not include an untested migration masquerading as a working backend.

## Activation sequence

1. Decide tenancy, data retention, and employee privacy with the organization.
2. Implement identity and role/organization authorization tests.
3. Add database migrations, generated types, and service-layer APIs.
4. Introduce an authenticated storage adapter, outbox, idempotency, and conflict resolution.
5. Move scoring and authoritative eligibility off the client.
6. Connect dormant forms and dashboards to real APIs; remove preview labels only when verified.
7. Run integration, authorization, restore, load, and real-device/network tests.
8. Obtain content-owner and organizational release approval.
