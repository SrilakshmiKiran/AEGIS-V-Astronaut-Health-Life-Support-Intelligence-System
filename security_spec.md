# AEGIS-V Firestore Security Specification

## 1. Data Invariants
1. Strict Ownership Isolation: Every workspace, PII record, observation, incident, consultation report, and snapshot belongs exclusively to userId == request.auth.uid with email_verified == true.
2. PII Isolation: User email and display name reside strictly in /users/{userId}/private/info.
3. Immutable Ownership & Timestamps: ownerId and createdAt are immutable; createdAt and updatedAt must equal request.time.
4. Master Gate Relational Check: Subcollections validate exists or existsAfter on /users/{userId}.
5. Terminal State Locking: Once an incident reaches CLOSED_RETAINED, subsequent updates are denied.
6. Strict Key & Size Enforcement: Create checks keys().hasAll() && keys().hasOnly(); updates check affectedKeys().hasOnly() and re-run validation helpers.
7. Operational Subcollections Isolation: opsState and opsRecords (including crew, med, EVA, cognitive, consultation, checklist, voice memo, extended bio/scan metadata, and mission routine/gamification records) require ownerId == request.auth.uid, strict enum validation on activityMode/lightDelayMode/recordType, and workspaceExists(userId).

## 2. Adversarial Test Cases (Dirty Dozen)
1. Unauthenticated read on /users/{uid} -> PERMISSION_DENIED.
2. Unverified email write on /users/{uid} -> PERMISSION_DENIED.
3. Cross-tenant get on /users/{uidA}/observations/{obsId} by uidB -> PERMISSION_DENIED.
4. Cross-tenant list on /users/{uidA}/incidents by uidB -> PERMISSION_DENIED.
5. Owner spoofing (ownerId != uidA) on create -> PERMISSION_DENIED.
6. Ghost field injection (extra unknown key) on create/update -> PERMISSION_DENIED.
7. ID poisoning (invalid characters or >128 chars in doc ID) -> PERMISSION_DENIED.
8. Client timestamp forgery (createdAt != request.time) -> PERMISSION_DENIED.
9. Type poisoning on update (string passed for boolean field) -> PERMISSION_DENIED.
10. PII leak attempt (uidB reading /users/{uidA}/private/info) -> PERMISSION_DENIED.
11. Terminal state bypass (updating CLOSED_RETAINED incident) -> PERMISSION_DENIED.
12. Resource exhaustion (>16KB markdown or >400 char notes) -> PERMISSION_DENIED.
