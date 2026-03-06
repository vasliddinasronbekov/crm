# Backend Permission Alignment Checklist (Phase 2)

This checklist aligns `apps/web` RBUI action permissions with backend endpoint guards for:

- Students page (`/dashboard/students`)
- Teachers page (`/dashboard/teachers`)
- Finance page (`/dashboard/finance`)

## 1) Frontend Permission Keys in Use

- `students.view`, `students.create`, `students.edit`, `students.delete`
- `teachers.view`, `teachers.create`, `teachers.edit`, `teachers.delete`
- `payments.view`, `payments.create`, `payments.edit`, `payments.delete`
- `expenses.view`, `expenses.create`, `expenses.edit`, `expenses.delete`

## 2) Endpoint Guard Matrix

| Domain | Endpoint(s) | Web Action | Current Backend Guard | Target Capability Guard | Status |
|---|---|---|---|---|---|
| Students | `/api/users/students/`, `/api/users/students/{id}/` | view/create/edit/delete | `HasRoleCapability` (`students.read`, `students.manage`) in `backend/users/views.py` | keep `HasRoleCapability` (already aligned) | DONE |
| Students | `/api/users/students/{id}/reactivate_account/` | restore/reactivate | `HasRoleCapability` (`students.reactivate`) | keep `HasRoleCapability` | DONE |
| Teachers | `/api/users/teachers/`, `/api/users/teachers/{id}/` | view/create/edit/delete | `HasRoleCapability` (`teachers.read`, `teachers.manage`) in `backend/users/views.py` | keep `HasRoleCapability` (already aligned) | DONE |
| Payments | `/api/v1/payment/`, `/api/v1/payment/{id}/` | view/create/edit/delete | `IsAdminOrReadOnly` in `backend/student_profile/views.py` | migrate to `HasRoleCapability` (`payments.read`, `payments.manage`) | TODO |
| Payments | `/api/v1/payment/{id}/send_reminder/`, `/api/v1/payment/bulk_send_reminders/` | reminder actions | inherited `IsAdminOrReadOnly` | explicit capability (ex: `payments.manage` or `payments.reminders`) | TODO |
| Payments | `/api/v1/payment/reminder-settings/` | settings write | inherited `IsAdminOrReadOnly` | explicit capability (ex: `payments.reminders`) | TODO |
| Expenses | `/api/v1/expense/`, `/api/v1/expense/{id}/` | view/create/edit/delete | `IsAdminUser` in `backend/student_profile/views.py` | migrate to `HasRoleCapability` (`expenses.read`, `expenses.manage`) | TODO |
| Expense types | `/api/v1/expense-type/` | view/create/edit/delete | `IsAdminUser` | capability guard (likely admin-only role set) | TODO |
| Payment types | `/api/v1/payment-type/` | view/create/edit/delete | `IsAdminUser` | capability guard (likely admin-only role set) | TODO |
| Finance read models | `/api/v1/student-profile/accounting/student-balances/` | view | `IsAuthenticated` + queryset filtering in `backend/student_profile/accounting_views.py` | add `HasRoleCapability` (`payments.read`/`expenses.read`/finance-specific read) | TODO |
| Finance read models | `/api/v1/student-profile/accounting/teacher-earnings/` | view + mark paid | `IsAuthenticated` + queryset filtering | add capability mapping for list/retrieve/`mark_paid` | TODO |
| Finance read models | `/api/v1/student-profile/accounting/financial-summaries/` | overview charts | `IsAdminUser` | move to capability guard for explicit role policy | TODO |
| Finance realtime | `/api/v1/student-profile/accounting/realtime-dashboard/` | operations feed | `IsAuthenticated` | add capability guard for staff-side roles only | TODO |

## 3) Backend Changes Required (Implementation Sequence)

1. Extend `CAPABILITY_MATRIX` in `backend/users/roles.py` with finance capabilities:
   - `payments.read`, `payments.manage`
   - `payments.reminders` (optional split)
   - `expenses.read`, `expenses.manage`
   - `finance.realtime.read` (optional explicit key for websocket/realtime panel)
2. Apply `HasRoleCapability` + `action_capabilities` to finance-related ViewSets:
   - `PaymentViewSet`, `ExpenseViewSet`, `PaymentTypeViewSet`, `ExpenseTypeViewSet`
   - `StudentBalanceViewSet`, `TeacherEarningsViewSet`, `FinancialSummaryViewSet`
   - `RealtimeAccountingDashboardView` (with `required_capability`)
3. Keep row-level filtering logic as second line of defense (do not remove `get_queryset` filtering).
4. Add or update tests under `backend/users/tests` and `backend/student_profile/tests`:
   - positive and negative role cases for list/create/update/delete
   - reminder and mark-paid actions
   - realtime dashboard access for non-staff roles must be denied

## 4) Verification Checklist

- [ ] Staff role can load Students/Teachers/Finance pages and perform allowed actions.
- [ ] Teacher role sees only allowed actions (no unauthorized create/delete where disallowed).
- [ ] Student role cannot access staff-side endpoints (`403` for guarded routes).
- [ ] Finance POST/PATCH/DELETE endpoints return `403` when capability missing.
- [ ] UI action states (disabled/hidden) match backend authorization outcomes.
- [ ] No endpoint allows write operations with only `IsAuthenticated`.
