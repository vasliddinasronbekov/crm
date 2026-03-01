-- LMS Fintech Schema (PostgreSQL)
-- All monetary amounts are stored as INTEGER/BIGINT in tiyin.
-- 1 UZS = 100 tiyin.

CREATE TABLE users_user (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(150) UNIQUE NOT NULL,
    email VARCHAR(255),
    is_teacher BOOLEAN NOT NULL DEFAULT FALSE,
    is_staff BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE student_profile_group (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    course_price_tiyin BIGINT NOT NULL CHECK (course_price_tiyin >= 0),
    main_teacher_id BIGINT REFERENCES users_user(id) ON DELETE SET NULL,
    days VARCHAR(100),
    start_day DATE NOT NULL,
    end_day DATE NOT NULL
);

CREATE TABLE student_profile_group_enrollment (
    id BIGSERIAL PRIMARY KEY,
    group_id BIGINT NOT NULL REFERENCES student_profile_group(id) ON DELETE CASCADE,
    student_id BIGINT NOT NULL REFERENCES users_user(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (group_id, student_id)
);

CREATE TABLE student_profile_student_account (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT UNIQUE NOT NULL REFERENCES users_user(id) ON DELETE CASCADE,
    balance_tiyin BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'frozen', 'deactivated')),
    status_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE student_profile_monthly_subscription_charge (
    id BIGSERIAL PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES student_profile_student_account(id) ON DELETE CASCADE,
    student_id BIGINT NOT NULL REFERENCES users_user(id) ON DELETE CASCADE,
    group_id BIGINT NOT NULL REFERENCES student_profile_group(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    monthly_price_tiyin BIGINT NOT NULL,
    charged_tiyin BIGINT NOT NULL,
    final_charge_tiyin BIGINT NOT NULL DEFAULT 0,
    refunded_tiyin BIGINT NOT NULL DEFAULT 0,
    settlement_status VARCHAR(20) NOT NULL DEFAULT 'none'
        CHECK (settlement_status IN ('none', 'deactivated', 'frozen')),
    settlement_note TEXT,
    charged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (student_id, group_id, year, month)
);

CREATE TABLE student_profile_attendance (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES users_user(id) ON DELETE CASCADE,
    group_id BIGINT NOT NULL REFERENCES student_profile_group(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    attendance_status VARCHAR(20) NOT NULL
        CHECK (attendance_status IN ('present', 'absent_unexcused', 'absence_excused')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (student_id, group_id, date)
);

CREATE TABLE student_profile_payment (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES users_user(id) ON DELETE CASCADE,
    group_id BIGINT REFERENCES student_profile_group(id) ON DELETE SET NULL,
    amount_tiyin BIGINT NOT NULL CHECK (amount_tiyin > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE student_profile_accounting_activity_log (
    id BIGSERIAL PRIMARY KEY,
    action_type VARCHAR(40) NOT NULL,
    actor_id BIGINT REFERENCES users_user(id) ON DELETE SET NULL,
    student_id BIGINT REFERENCES users_user(id) ON DELETE SET NULL,
    group_id BIGINT REFERENCES student_profile_group(id) ON DELETE SET NULL,
    message VARCHAR(500) NOT NULL,
    amount_tiyin BIGINT,
    balance_after_tiyin BIGINT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_attendance_student_group_date
    ON student_profile_attendance (student_id, group_id, date DESC);
CREATE INDEX idx_activity_created_action
    ON student_profile_accounting_activity_log (created_at DESC, action_type);
CREATE INDEX idx_activity_student_created
    ON student_profile_accounting_activity_log (student_id, created_at DESC);

-- Teacher payroll obligation view (40% share, pro-rated using final_charge_tiyin).
CREATE VIEW v_teacher_payroll_owed AS
SELECT
    g.main_teacher_id AS teacher_id,
    SUM(ROUND(msc.final_charge_tiyin * 0.40))::BIGINT AS payroll_tiyin
FROM student_profile_monthly_subscription_charge msc
JOIN student_profile_group g ON g.id = msc.group_id
WHERE g.main_teacher_id IS NOT NULL
GROUP BY g.main_teacher_id;
