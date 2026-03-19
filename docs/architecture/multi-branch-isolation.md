# Multi-Branch Isolation (Phase 1)

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

## Next phases
- Phase 2: enforce branch scope across CRM, messaging, analytics, and social modules.
- Phase 3: introduce org-level structure (`Organization` -> `Branch`) for multi-company SaaS isolation.
- Phase 4: per-branch audit dashboards and branch-level RBAC overrides.
