# Multi-Branch Isolation (Phase 1 + Phase 2)

## Goal
Enable one education company to run multiple physical branches inside one unified platform, while keeping operational data isolated by branch for non-superusers.

## Implemented in Phase 1

### 1) Branch memberships
- Added `users.BranchMembership` model.
- Users can be linked to one or more branches.
- One active primary branch per user is enforced.
- Legacy `users.User.branch` is still supported for backward compatibility.

### 2) Active branch resolution
Branch context is resolved in this order:
1. `?active_branch=` / `?branch_id=` / `?branch=` query param
2. `X-Active-Branch` / `X-Branch-Id` header
3. User primary branch membership
4. User legacy `branch`

If a non-superuser requests a branch they are not assigned to, request is denied (`403`).

### 3) New API endpoint
- `GET /api/auth/branch-context/`
- Returns:
  - `is_global_scope`
  - `active_branch_id`
  - `accessible_branch_ids`
  - `branches[]`

Use this endpoint in frontend branch switcher.

### 4) Branch-scoped endpoints (critical)
Scoping added to high-traffic and finance-critical endpoints:
- `users.UserViewSet`
- `users.StudentViewSet`
- `users.TeacherViewSet`
- `student_profile.GroupViewSet`
- `student_profile.AttendanceViewSet`
- `student_profile.ExamScoreViewSet`
- `student_profile.PaymentViewSet`
- Accounting viewsets (`student balances`, `teacher earnings`, `fines`, `transactions`, etc.)

### 5) Write-time branch guardrails
Write operations now validate branch ownership for scoped users:
- attendance create/update/bulk
- payment create/update

## Frontend integration guidance
1. On login/app init call `GET /api/auth/branch-context/`.
2. Store `active_branch_id` in localStorage.
3. Attach selected branch to API requests (`X-Branch-Id` header recommended).
4. Build a branch switcher UI for users with multiple branch memberships.

## Migration strategy
1. Deploy migration creating `BranchMembership`.
2. Data migration auto-seeds memberships from existing `User.branch`.
3. Backfill branch for legacy records with null branch (groups/payments where needed).
4. Add admin UI for assigning multi-branch memberships.

## Implemented in Phase 2

### 1) Task domain
- Branch-scoped access for boards/lists/tasks/autotasks and bulk task creation.
- Legacy mixed-branch boards are excluded from scoped task/list/autotask views.
- Certificate endpoints branch-scoped by student/course/issuer.
- Certificate template ownership added via:
  - `task.CertificateTemplate.branch`
  - `task.CertificateTemplate.created_by`
- Scoped users can only manage templates in their active branch.
- Default template toggling is now isolated per branch (not global).
- Scoped certificate generation no longer falls back to global templates.
- Certificate eligibility and list responses now avoid shared-course cross-branch leakage.

### 2) Messaging domain
- Branch-scoped filtering across:
  - conversation lists
  - chat history/messages
  - file upload/delete conversation access
  - email campaigns/logs/automations
- Legacy mixed-branch conversations are excluded from scoped querysets.
- Cross-branch participant/recipient writes are blocked.
- Attachment uploads now also block legacy mixed-branch conversation access.
- Email campaigns/automations now hide legacy mixed-branch recipient/template links.
- Email campaign create/update now validates template/course/group/recipient branch scope.
- Email read scopes now honor explicit `active_branch` for superusers (optional narrowed view).
- Email logs now exclude legacy mixed-branch rows even when campaign creator is in-scope.
- Automated email create/update now validates template ownership against active branch scope.

### 3) Social domain
- Forums now require authentication and are branch-scoped.
- Study groups/posts/comments are branch-scoped for read and write.
- Feed and peer conversations are branch-scoped and cross-branch thread leakage is blocked.
- Legacy mixed-branch forums/study-groups are excluded from scoped listings.

### 4) Subscriptions webhook hardening
- Payme/Click handlers are method-scoped and ID-scoped to prevent cross-gateway updates.
- Added safer numeric parsing and amount validation.
- Added idempotent handling for repeated webhook delivery paths.

### 5) Subscriptions read-side branch isolation
- Staff reads for subscriptions/payments/invoices are now branch-scoped for non-global users.
- Stats endpoints (`overview`, `revenue`) aggregate only active-branch data for scoped admins.
- Payment/invoice/stats reads now exclude legacy records with cross-branch linked subscriptions/payments.

## Next phases
- Phase 3: introduce org-level structure (`Organization` -> `Branch`) for multi-company SaaS isolation.
- Phase 4: per-branch audit dashboards and branch-level RBAC overrides.
