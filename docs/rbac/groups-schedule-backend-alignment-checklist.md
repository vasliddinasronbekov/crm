# Backend Permission Alignment Checklist (Groups + Schedule)

This checklist aligns web RBUI actions for:

- `/dashboard/groups`
- `/dashboard/groups/[id]`
- `/dashboard/schedule`

with backend endpoint guards.

## 1) Frontend Permission Keys in Use

- `groups.view`, `groups.create`, `groups.edit`, `groups.delete`
- `attendance.view`, `attendance.create`, `attendance.edit`
- `payments.view`, `payments.create`

## 2) Endpoint Guard Matrix

| Domain | Endpoint(s) | Web Action | Backend Guard | Capability |
|---|---|---|---|---|
| Groups | `/api/student-profile/groups/` | list/retrieve | `IsAuthenticated` + `HasRoleCapability` + object guard | `groups.read` |
| Groups | `/api/student-profile/groups/` | create/update/delete | `IsAuthenticated` + `HasRoleCapability` + object guard | `groups.manage` |
| Groups | `/api/student-profile/groups/schedule-health/` | schedule health stats | `IsAuthenticated` + `HasRoleCapability` | `groups.read` |
| Attendance | `/api/student-profile/attendance/` | list/retrieve | `IsAuthenticated` + `HasRoleCapability` + existing permission class | `attendance.read` |
| Attendance | `/api/student-profile/attendance/` | mark/update/delete | `IsAuthenticated` + `HasRoleCapability` + existing permission class | `attendance.manage` |
| Attendance | `/api/student-profile/attendance/bulk_create/` | bulk mark | `IsAuthenticated` + `HasRoleCapability` + existing permission class | `attendance.manage` |
| Payments | `/api/v1/payment/` | list/retrieve | `IsAuthenticated` + `HasRoleCapability` + existing permission class | `payments.read` |
| Payments | `/api/v1/payment/` | create/update/delete/reminders | `IsAuthenticated` + `HasRoleCapability` + existing permission class | `payments.manage` |

## 3) Validation and Data Integrity Rules

- Group schedule now validates:
  - `end_day >= start_day`
  - `end_time > start_time`
  - room branch consistency (`room.branch == group.branch` when both set)
  - day tokens must be valid
  - room/teacher overlap conflicts are blocked with `schedule_conflicts` payload

## 4) Verification

- [ ] Non-staff users cannot create/update/delete groups (`403`)
- [ ] Group create/update returns `400` with `schedule_conflicts` on overlap
- [ ] Schedule health endpoint returns conflict + capacity metrics for authorized users
- [ ] Attendance create/bulk endpoints return `403` when capability missing
- [ ] Payment create/update/delete endpoints return `403` when capability missing
- [ ] Frontend action-level disabling/hiding matches backend authorization behavior
