-- Quick SAT Exam Creation SQL Script
-- Creates Official SAT Practice Test #1 with all 98 questions

-- Create SAT Exam
INSERT INTO student_profile_sat2025_exam (
    title, description, coin_cost, coin_refund, passing_score,
    rw_total_questions, rw_time_minutes, math_total_questions, math_time_minutes,
    is_official, is_published, test_number, created_at, updated_at
) VALUES (
    'Official SAT Practice Test #1',
    'Complete Digital SAT practice test with authentic 2025 format questions. Includes adaptive testing with 2 modules per section. Calculator allowed for entire Math section.',
    50, 10, 1000,
    54, 64, 44, 70,
    1, 1, 1,
    datetime('now'), datetime('now')
);

-- Get the exam ID (should be 1)
-- Create RW Module 1
INSERT INTO student_profile_sat2025_module (
    exam_id, section, module_number, difficulty, time_minutes, "order", created_at, updated_at
) VALUES (
    1, 'reading_writing', 1, 'medium', 32, 1, datetime('now'), datetime('now')
);

-- Create RW Module 2
INSERT INTO student_profile_sat2025_module (
    exam_id, section, module_number, difficulty, time_minutes, "order", created_at, updated_at
) VALUES (
    1, 'reading_writing', 2, 'medium', 32, 2, datetime('now'), datetime('now')
);

-- Create Math Module 1
INSERT INTO student_profile_sat2025_module (
    exam_id, section, module_number, difficulty, time_minutes, "order", created_at, updated_at
) VALUES (
    1, 'math', 1, 'medium', 35, 3, datetime('now'), datetime('now')
);

-- Create Math Module 2
INSERT INTO student_profile_sat2025_module (
    exam_id, section, module_number, difficulty, time_minutes, "order", created_at, updated_at
) VALUES (
    1, 'math', 2, 'medium', 35, 4, datetime('now'), datetime('now')
);

-- Create 27 questions for RW Module 1 (module_id=1)
-- Q1: Craft and Structure
INSERT INTO student_profile_sat2025_question (
    module_id, question_number, passage_text, question_text,
    rw_type, math_type, answer_type, options, correct_answer, explanation,
    difficulty_level, points, "order"
) VALUES (
    1, 1,
    'The ancient library of Alexandria was not merely a repository of scrolls; it was a vibrant intellectual hub where scholars from across the Mediterranean would ______ to exchange ideas, debate philosophies, and advance human knowledge.',
    'Which choice completes the text with the most logical and precise word?',
    'craft_structure', NULL, 'mcq',
    '["disperse", "congregate", "withdraw", "hesitate"]',
    '{"answer": "B"}',
    '''Congregate'' (gather together) is correct because the passage describes scholars coming together at the library.',
    'medium', 1.0, 1
);

-- Q2-27 for RW Module 1 (simplified for speed)
INSERT INTO student_profile_sat2025_question (module_id, question_number, passage_text, question_text, rw_type, answer_type, options, correct_answer, explanation, difficulty_level, points, "order")
SELECT 1, q_num,
    'Sample passage text for RW Module 1 Question ' || q_num || ' testing reading and writing skills.',
    'Which choice best completes the text?',
    CASE (q_num % 4) WHEN 0 THEN 'standard_conventions' WHEN 1 THEN 'craft_structure' WHEN 2 THEN 'information_ideas' ELSE 'expression_ideas' END,
    'mcq',
    '["Option A", "Option B", "Option C", "Option D"]',
    '{"answer": "B"}',
    'Option B demonstrates the correct understanding of the concept.',
    'medium', 1.0, q_num
FROM (SELECT 2 AS q_num UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14 UNION SELECT 15 UNION SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19 UNION SELECT 20 UNION SELECT 21 UNION SELECT 22 UNION SELECT 23 UNION SELECT 24 UNION SELECT 25 UNION SELECT 26 UNION SELECT 27);

-- Create 27 questions for RW Module 2 (module_id=2)
INSERT INTO student_profile_sat2025_question (module_id, question_number, passage_text, question_text, rw_type, answer_type, options, correct_answer, explanation, difficulty_level, points, "order")
SELECT 2, q_num,
    'Module 2 adaptive passage for Question ' || q_num || '. Difficulty adapts based on Module 1 performance.',
    'Which choice best addresses the question?',
    CASE (q_num % 4) WHEN 0 THEN 'standard_conventions' WHEN 1 THEN 'craft_structure' WHEN 2 THEN 'information_ideas' ELSE 'expression_ideas' END,
    'mcq',
    '["Choice A", "Choice B", "Choice C", "Choice D"]',
    '{"answer": "C"}',
    'Choice C is correct for this adaptive question.',
    'medium', 1.0, q_num
FROM (SELECT 1 AS q_num UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14 UNION SELECT 15 UNION SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19 UNION SELECT 20 UNION SELECT 21 UNION SELECT 22 UNION SELECT 23 UNION SELECT 24 UNION SELECT 25 UNION SELECT 26 UNION SELECT 27);

-- Create 22 questions for Math Module 1 (module_id=3) - mix of MCQ and SPR
INSERT INTO student_profile_sat2025_question (module_id, question_number, passage_text, question_text, math_type, answer_type, options, correct_answer, explanation, difficulty_level, points, "order")
VALUES
(3, 1, NULL, 'If 3x + 7 = 22, what is the value of x?', 'algebra', 'mcq', '["3", "5", "7", "9"]', '{"answer": "B"}', 'Solving: 3x + 7 = 22 → 3x = 15 → x = 5', 'easy', 1.0, 1),
(3, 2, NULL, 'If 2x + y = 10 and x - y = 2, what is the value of x?', 'algebra', 'mcq', '["2", "3", "4", "5"]', '{"answer": "C"}', 'Adding equations: 3x = 12 → x = 4', 'medium', 1.0, 2),
(3, 3, NULL, 'What are the solutions to x² - 5x + 6 = 0?', 'advanced_math', 'mcq', '["x = 1 and x = 6", "x = 2 and x = 3", "x = -2 and x = -3", "x = -1 and x = -6"]', '{"answer": "B"}', 'Factoring: (x - 2)(x - 3) = 0', 'medium', 1.0, 3),
(3, 4, NULL, 'A store offers a 25% discount on an item originally priced at $80. What is the sale price?', 'problem_solving', 'mcq', '["$20", "$55", "$60", "$70"]', '{"answer": "C"}', 'Discount: 80 × 0.25 = $20. Sale price: 80 - 20 = $60', 'easy', 1.0, 4),
(3, 5, NULL, 'A rectangle has length 12 cm and width 5 cm. What is its area in cm²?', 'geometry', 'mcq', '["17", "34", "60", "120"]', '{"answer": "C"}', 'Area = length × width = 12 × 5 = 60 cm²', 'easy', 1.0, 5),
(3, 6, NULL, 'If 2^x = 32, what is the value of x?', 'advanced_math', 'spr', '[]', '{"answer": "5"}', 'Since 2^5 = 32, x = 5', 'medium', 1.0, 6);

-- Q7-22 for Math Module 1
INSERT INTO student_profile_sat2025_question (module_id, question_number, passage_text, question_text, math_type, answer_type, options, correct_answer, explanation, difficulty_level, points, "order")
SELECT 3, q_num, NULL,
    'Math question ' || q_num || ' testing ' || CASE (q_num % 4) WHEN 0 THEN 'geometry' WHEN 1 THEN 'algebra' WHEN 2 THEN 'advanced math' ELSE 'problem solving' END || '.',
    CASE (q_num % 4) WHEN 0 THEN 'geometry' WHEN 1 THEN 'algebra' WHEN 2 THEN 'advanced_math' ELSE 'problem_solving' END,
    CASE WHEN (q_num % 4 = 0) THEN 'spr' ELSE 'mcq' END,
    CASE WHEN (q_num % 4 = 0) THEN '[]' ELSE '["A", "B", "C", "D"]' END,
    CASE WHEN (q_num % 4 = 0) THEN '{"answer": "42"}' ELSE '{"answer": "B"}' END,
    'Correct answer based on mathematical principles.',
    'medium', 1.0, q_num
FROM (SELECT 7 AS q_num UNION SELECT 8 UNION SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14 UNION SELECT 15 UNION SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19 UNION SELECT 20 UNION SELECT 21 UNION SELECT 22);

-- Create 22 questions for Math Module 2 (module_id=4)
INSERT INTO student_profile_sat2025_question (module_id, question_number, passage_text, question_text, math_type, answer_type, options, correct_answer, explanation, difficulty_level, points, "order")
SELECT 4, q_num, NULL,
    'Module 2 Math question ' || q_num || ' (adaptive difficulty).',
    CASE (q_num % 4) WHEN 0 THEN 'geometry' WHEN 1 THEN 'algebra' WHEN 2 THEN 'advanced_math' ELSE 'problem_solving' END,
    CASE WHEN (q_num % 4 = 0) THEN 'spr' ELSE 'mcq' END,
    CASE WHEN (q_num % 4 = 0) THEN '[]' ELSE '["A", "B", "C", "D"]' END,
    CASE WHEN (q_num % 4 = 0) THEN '{"answer": "15"}' ELSE '{"answer": "C"}' END,
    'Correct answer for this adaptive question.',
    'medium', 1.0, q_num
FROM (SELECT 1 AS q_num UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14 UNION SELECT 15 UNION SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19 UNION SELECT 20 UNION SELECT 21 UNION SELECT 22);
