# Staff-Side Route Permission Audit (apps/web)

This artifact is for the web app dashboard only.

- Auth/routing entrance remains web-app level (`/login` flow backed by backend truth).
- Scope here is staff-side roles only:
  - `superuser`, `superadmin`, `admin`, `director`, `manager`, `crm_manager`, `lms_manager`, `staff`, `teacher`

Primary code source of truth:

- `apps/web/lib/permissions.ts`
  - `STAFF_ROUTE_FAMILY_POLICIES`
  - `PAGE_PERMISSION_RULES` (derived runtime matcher input)
  - `STAFF_ROUTE_PERMISSION_AUDIT` (flattened audit view with effective staff roles)

## Core route families

| Family | Patterns | Current permission | Staff-side intent | Backend parity note |
|---|---|---|---|---|
| students | `/dashboard/students*` | `students.view` | `staff_and_teacher` | Keep student list/detail endpoint guards aligned. |
| teachers | `/dashboard/teachers*` | `teachers.view` | `staff_ops_only` | Keep teacher directory/admin endpoints ops-restricted. |
| groups | `/dashboard/groups*`, `/dashboard/rooms*` | `groups.view` | `staff_and_teacher` | Align group/room data visibility with role scope. |
| schedule | `/dashboard/schedule*` | `groups.view` | `staff_and_teacher` | Keep schedule feed visibility tied to group visibility rules. |
| attendance | `/dashboard/attendance*` | `attendance.view` | `staff_and_teacher` | Keep read/write attendance guards teacher-capable. |
| payments/finance/accounting/subscriptions | `/dashboard/payments*`, `/dashboard/finance*`, `/dashboard/accounting*`, `/dashboard/subscriptions*` | `payments.view` | `staff_ops_only` | Financial endpoints must reject non-ops roles consistently. |
| expenses | `/dashboard/expenses*` | `expenses.view` | `staff_ops_only` | Expense view/write guards should map to expense capabilities. |
| CRM | `/dashboard/crm*` | `crm.view` | `staff_ops_only` | CRM endpoints should enforce explicit CRM capability checks. |
| messaging | `/dashboard/inbox*`, `/dashboard/messaging*` | `messaging.view` | `staff_and_teacher` | Conversation/message visibility should be role-scoped. |
| HR | `/dashboard/hr*` | `hr.view` | `staff_ops_only` | HR records remain restricted to ops roles. |
| analytics/reports | `/dashboard/analytics*`, `/dashboard/leaderboard*`, `/dashboard/reports*`, `/dashboard/data-view*` | `analytics.view` + `reports.view` | `staff_and_teacher` | Report and analytics payloads should be role-filtered server-side. |
| LMS | `/dashboard/lms*`, `/dashboard/lms/modules*`, `/dashboard/lms/lessons*`, `/dashboard/lms/assignments*`, `/dashboard/courses*` | `lms.view`, `modules.view`, `lessons.view`, `assignments.view`, `courses.view` | `staff_and_teacher` | Keep LMS module-level guards aligned with frontend route checks. |

## Notes

- This file is intentionally minimal and mirrors the code constants above.
- Future slices should align backend endpoint guards and frontend action-level controls to this map.
