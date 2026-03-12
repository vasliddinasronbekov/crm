# Payment and Money Flow Deep Dive (Web + Backend)

Last updated: 2026-03-11
Scope: `apps/web`, `backend`

## 1) What is the source of truth

### Core monetary entities
- `backend/student_profile/models.py:282` `Payment`
- `backend/student_profile/models.py:304` `CashPaymentReceipt`
- `backend/student_profile/accounting_models.py:10` `StudentAccount`
- `backend/student_profile/accounting_models.py:204` `StudentBalance`
- `backend/student_profile/accounting_models.py:324` `TeacherEarnings`
- `backend/student_profile/accounting_models.py:399` `StudentFine`
- `backend/student_profile/accounting_models.py:508` `AccountTransaction`
- `backend/student_profile/accounting_models.py:762` `FinancialSummary`

### Access control source of truth
- Capability matrix: `backend/users/roles.py:99`
- Capability enforcement: `backend/users/permissions.py:10`

### Web-side consumers (presentation + interaction)
- API client: `apps/web/lib/api.ts`
- Payments workspace: `apps/web/app/dashboard/payments/page.tsx`
- Finance workspace: `apps/web/app/dashboard/finance/page.tsx`
- Currency context: `apps/web/contexts/SettingsContext.tsx`
- Currency utilities: `apps/web/lib/utils/currency.ts`

## 2) Auth and portal split (critical for behavior)

- Staff web login endpoint: `POST /api/auth/login/`
  - serializer: `backend/users/serializers.py:101` (`StaffTokenObtainPairSerializer`)
- Student/parent login endpoint: `POST /api/v1/student-profile/login/`
  - serializer: `backend/users/serializers.py:119` (`StudentTokenObtainPairSerializer`)

Meaning:
- Staff-side users should enter web through staff login.
- Student-side users are separated at auth serializer level.

## 3) Canonical payment creation/update/delete flow

### Create
1. Web submits payment (`apps/web/app/dashboard/payments/page.tsx:273`).
2. Backend `PaymentWriteSerializer` resolves amount/course_price:
   - Course mode derives from group/course (`backend/student_profile/serializers.py:561`).
   - Manual mode validates explicit values (`backend/student_profile/serializers.py:539`).
3. `PaymentViewSet.perform_create` (`backend/student_profile/views.py:744`):
   - save payment
   - `apply_payment_to_student_account(...)` (`backend/student_profile/services/financial_automation.py:232`)
   - `ensure_cash_receipt(...)` (`backend/student_profile/receipt_service.py:82`)

### Update
- `PaymentViewSet.perform_update` (`backend/student_profile/views.py:750`):
  - rollback old paid state if changed (`rollback_paid_payment`, `financial_automation.py:258`)
  - apply new paid state if needed (`apply_payment_to_student_account`, `financial_automation.py:232`)
  - refresh cash receipt existence (`ensure_cash_receipt`)

### Delete
- `PaymentViewSet.perform_destroy` (`backend/student_profile/views.py:781`):
  - rollback if payment was paid
  - then delete

## 4) Cash receipt flow

- Receipt generated only for cash method:
  - method detection: `backend/student_profile/receipt_service.py:22`
- Unique identifiers:
  - receipt number: `backend/student_profile/receipt_service.py:46`
  - receipt token: `backend/student_profile/receipt_service.py:56`
- Remaining balance snapshot:
  - `backend/student_profile/receipt_service.py:63`
- Payload + QR:
  - `backend/student_profile/receipt_service.py:132`
- API endpoints:
  - `GET /api/v1/payment/{id}/cash-receipt/` (`backend/student_profile/views.py:859`)
  - `GET /api/v1/payment/cash-receipt-by-token/{token}/` (`backend/student_profile/views.py:870`)
  - `GET /api/v1/payment/receipt/verify/{token}/` (`backend/student_profile/views.py:981`)
- Web preview/print modal:
  - `apps/web/components/CashReceiptPreviewModal.tsx`

## 5) Debt, balance, salary, and status logic

### Student debt/account state
- Internal wallet balance: `StudentAccount.balance_tiyin` (negative means debt)
  - model: `backend/student_profile/accounting_models.py:31`
- Group-level debt: `StudentBalance.balance`
  - calculation: `backend/student_profile/accounting_models.py:265`

### Monthly subscription billing
- Deducts course fee from `StudentAccount`: `apply_monthly_subscription_charge` (`financial_automation.py:165`)
- Attendance settlement can prorate and refund (`financial_automation.py:296`)

### Attendance-triggered status transitions
- policy runner: `apply_attendance_policies` (`financial_automation.py:382`)
- unexcused >= 3 -> deactivated (`financial_automation.py:405`)
- excused >= 3 -> frozen (`financial_automation.py:418`)

### Manual status controls
- API actions in student viewset:
  - activate/freeze/deactivate/reactivate at `backend/users/views.py:499`, `:514`, `:527`, `:540`
- shared setter:
  - `set_student_account_status` (`financial_automation.py:494`)
  - also syncs `User.is_active` (`financial_automation.py:516`)

### Teacher payroll/salary
- Accounting payroll metric from subscription charges:
  - `teacher_payroll_owed_tiyin` (`financial_automation.py:561`)
- HR salary model and endpoint:
  - models `backend/hr/models.py:7`, `:34`
  - calculate endpoint `backend/hr/views.py:39`

## 6) Currency and conversion path

### Backend rates
- rates service: `backend/core/currency_rates.py`
- endpoint: `GET /api/v1/currency/rates/` (`backend/core/views.py:252`)

### Web conversion
- rates loaded in settings context: `apps/web/contexts/SettingsContext.tsx:443`
- conversion helpers:
  - to selected currency (`SettingsContext.tsx:551`)
  - from selected currency (`SettingsContext.tsx:555`)
- formatter helpers:
  - `apps/web/lib/utils/currency.ts:77`

## 7) Contract map: web hook -> API -> backend

| Web consumer | API | Backend handler | Money side effects |
|---|---|---|---|
| `useCreatePayment` (`apps/web/lib/hooks/usePayments.ts:247`) | `POST /api/v1/payment/` | `PaymentViewSet.perform_create` | account balance apply + cash receipt ensure |
| `useUpdatePayment` (`usePayments.ts:285`) | `PATCH /api/v1/payment/{id}/` | `PaymentViewSet.perform_update` | rollback/apply on paid changes |
| `useDeletePayment` (`usePayments.ts:356`) | `DELETE /api/v1/payment/{id}/` | `PaymentViewSet.perform_destroy` | paid rollback before delete |
| payments page receipt button | `GET /api/v1/payment/{id}/cash-receipt/` | `PaymentViewSet.cash_receipt` | no mutation |
| students status controls | `/api/users/students/{id}/activate_account/` etc. | `StudentViewSet` actions | account status + user active sync |
| finance data hooks | `/api/v1/student-profile/accounting/*` | accounting viewsets | read-only reporting |

## 8) Current drift and risks (priority)

### P0
1. **Legacy payment endpoint bypass risk**
   - `backend/student_profile/views.py:1225` `CreatePaymentView` exists outside capability mapping.
   - It should be audited/locked/deprecated in favor of `PaymentViewSet`.

2. **Dual ledger behavior can diverge**
   - `StudentAccount` and `StudentBalance` are updated through different paths.
   - Monthly fee task updates both systems via separate logic (`backend/student_profile/tasks.py:445` onward).
   - Needs explicit contract: what drives debt shown to staff and students.

3. **Teacher earnings creation path is incomplete**
   - `TeacherEarnings` model exists but no canonical create hook in payment flow.
   - risk: payroll screens can drift from real payment data.

### P1
4. **Accounting access mostly legacy-flag based in `accounting_views.py`**
   - uses `is_staff/is_teacher` filters, not capability matrix per action.

5. **`AccountTransaction` model helper methods are mostly not wired into payment lifecycle**
   - audit trail may be partial.

6. **Duplicate or legacy URL surfaces**
   - multiple payment/report paths exist in project URL config (`backend/edu_project/urls.py`, `backend/student_profile/urls.py`).

## 9) Immediate hardening backlog (recommended sequence)

1. Lock/deprecate legacy payment create/callback endpoints, keep one canonical payment write path.
2. Define canonical debt source for each UI surface (account vs group balance) and enforce consistency.
3. Wire teacher earnings generation into paid payment transitions (create/update/delete) transactionally.
4. Wire `AccountTransaction` creation into canonical payment/fine/monthly-charge lifecycle.
5. Move accounting endpoints to capability-based guards (`HasRoleCapability` + action map).
6. Keep web as consumer; avoid duplicating backend money logic in page components.

## 10) Test anchors to keep green

- payment role capability:
  - `backend/student_profile/tests/test_payment_role_capability.py`
- payment pricing autofill:
  - `backend/student_profile/tests/test_payment_pricing_autofill.py`
- financial automation:
  - `backend/student_profile/tests/test_financial_automation.py`
- group/schedule health:
  - `backend/student_profile/tests/test_group_schedule_health.py`

