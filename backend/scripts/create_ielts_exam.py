#!/usr/bin/env python3
"""
Create Realistic IELTS Exam - Full 4 Sections
Based on authentic 2025 IELTS exam patterns

This script creates a complete IELTS exam with:
- Reading: 3 passages, 40 questions (60 minutes)
- Listening: 4 parts, 40 questions (30 minutes)
- Writing: Task 1 & Task 2 (60 minutes)
- Speaking: Part 1, 2, 3 (11-14 minutes)

Usage:
    python manage.py shell < scripts/create_ielts_exam.py
"""

import os
import sys
import django

# Setup Django environment
sys.path.append('/home/gradientvvv/untilIwin/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'edu_project.settings')
django.setup()

from student_profile.models import IELTSExam, IELTSQuestion
from decimal import Decimal

print("=" * 80)
print("Creating Realistic IELTS Exam - Full 4 Sections")
print("=" * 80)

# ============================================================================
# SECTION 1: READING (60 minutes, 40 questions)
# ============================================================================

print("\n[1/4] Creating IELTS Reading Section...")

# Delete existing reading exam if it exists
IELTSExam.objects.filter(section='reading').delete()

reading_exam = IELTSExam.objects.create(
    section='reading',
    title='IELTS Academic Reading Practice Test 1',
    description='Complete academic reading test with 3 passages covering diverse topics. Includes multiple question types: multiple choice, True/False/Not Given, matching headings, and sentence completion.',
    coin_cost=50,
    coin_refund=10,
    time_limit_minutes=60,
    passing_band_score=Decimal('5.0'),
    instructions='''INSTRUCTIONS TO CANDIDATES

• Answer all questions
• You have 60 minutes to complete this test
• Write your answers on the answer sheet
• Do NOT write on the question paper
• Use a pencil (you may use a pen but it is not recommended)
• Check your spelling carefully
• You may write your answers in CAPITAL LETTERS or lower case

INFORMATION FOR CANDIDATES

• There are 40 questions in this test
• Each question carries 1 mark
• Answers which are unclear or ambiguous may not receive marks''',
    is_active=True
)

# PASSAGE 1: The History of Timekeeping (Academic - Science/History)
passage_1_text = """The History of Timekeeping

A. For millennia, humans have sought to measure time with increasing precision. The earliest timekeeping devices were natural phenomena - the movement of the sun across the sky, the phases of the moon, and the changing seasons. Ancient civilizations constructed elaborate monuments like Stonehenge to track celestial events and mark the passage of time. These astronomical observations formed the foundation of early calendars, which were crucial for agricultural societies that needed to know when to plant and harvest crops.

B. The invention of mechanical timekeeping devices represented a quantum leap in precision. The first mechanical clocks appeared in medieval European monasteries around the 13th century. These devices used falling weights to power a series of gears, with an escapement mechanism to regulate the movement. However, these early clocks were notoriously inaccurate, often losing or gaining as much as 15 minutes per day. It wasn't until Christiaan Huygens invented the pendulum clock in 1656 that mechanical timekeeping achieved accuracy within seconds per day.

C. The 20th century brought revolutionary changes in timekeeping technology. In 1927, the first quartz clock was developed, utilizing the piezoelectric properties of quartz crystals to maintain extraordinarily stable oscillations. Quartz clocks were accurate to within fractions of a second per day, representing a thousand-fold improvement over mechanical predecessors. However, the most significant breakthrough came in 1955 with the development of the atomic clock at the National Physical Laboratory in England. Atomic clocks measure time by detecting the microwave signal emitted by electrons as they change energy levels within atoms, typically cesium-133.

D. Today's atomic clocks are so precise that they would neither gain nor lose even one second over the entire age of the universe - approximately 13.8 billion years. This extraordinary accuracy has profound practical applications. The Global Positioning System (GPS), for instance, relies on atomic clocks to provide location data accurate to within meters. Because GPS satellites travel at high speeds and experience different gravitational fields than receivers on Earth, Einstein's theories of relativity must be accounted for in the timing calculations. Without the precision of atomic clocks, GPS navigation would be impossible. Modern telecommunications, power grid synchronization, and financial transaction timestamps all depend on this level of accuracy.

E. Looking ahead, researchers are developing optical atomic clocks that promise even greater precision by using visible light instead of microwaves. These devices could potentially detect variations in Earth's gravitational field or even test fundamental physics theories. As our ability to measure time continues to improve, it opens new frontiers in science and technology that were previously unimaginable."""

# PASSAGE 1 QUESTIONS (Questions 1-13)

# Questions 1-5: Multiple Choice
questions_1_5 = [
    {
        'order': 1,
        'type': 'multiple_choice',
        'text': 'What was the primary purpose of early astronomical observations?',
        'options': ['A) Religious ceremonies', 'B) Agricultural planning', 'C) Navigation at sea', 'D) Scientific research'],
        'answer': 'B) Agricultural planning'
    },
    {
        'order': 2,
        'type': 'multiple_choice',
        'text': 'The main problem with the first mechanical clocks was that they',
        'options': ['A) were too expensive to produce', 'B) required constant maintenance', 'C) lacked sufficient accuracy', 'D) were too large for practical use'],
        'answer': 'C) lacked sufficient accuracy'
    },
    {
        'order': 3,
        'type': 'multiple_choice',
        'text': 'What characteristic of quartz crystals makes them useful for timekeeping?',
        'options': ['A) Their resistance to temperature changes', 'B) Their stable oscillations', 'C) Their availability and low cost', 'D) Their durability over time'],
        'answer': 'B) Their stable oscillations'
    },
    {
        'order': 4,
        'type': 'multiple_choice',
        'text': 'According to the passage, GPS systems require atomic clock precision because',
        'options': ['A) satellites are very far from Earth', 'B) of the effects described by relativity theory', 'C) radio signals degrade over distance', 'D) of interference from other satellites'],
        'answer': 'B) of the effects described by relativity theory'
    },
    {
        'order': 5,
        'type': 'multiple_choice',
        'text': 'Optical atomic clocks differ from current atomic clocks in that they use',
        'options': ['A) different types of atoms', 'B) visible light instead of microwaves', 'C) multiple crystals for redundancy', 'D) digital rather than analog technology'],
        'answer': 'B) visible light instead of microwaves'
    }
]

# Questions 6-9: True/False/Not Given
questions_6_9 = [
    {
        'order': 6,
        'type': 'true_false_notgiven',
        'text': 'Stonehenge was built primarily as a timekeeping device.',
        'answer': 'Not Given'
    },
    {
        'order': 7,
        'type': 'true_false_notgiven',
        'text': 'Christiaan Huygens improved clock accuracy to within seconds per day.',
        'answer': 'True'
    },
    {
        'order': 8,
        'type': 'true_false_notgiven',
        'text': 'The first atomic clock was developed in the United States.',
        'answer': 'False'
    },
    {
        'order': 9,
        'type': 'true_false_notgiven',
        'text': 'Financial transactions require the same level of timing precision as GPS.',
        'answer': 'Not Given'
    }
]

# Questions 10-13: Sentence Completion
questions_10_13 = [
    {
        'order': 10,
        'type': 'sentence_completion',
        'text': 'The earliest timekeeping methods relied on observing __________ phenomena.',
        'answer': 'natural'
    },
    {
        'order': 11,
        'type': 'sentence_completion',
        'text': 'Medieval mechanical clocks used falling __________ to generate power.',
        'answer': 'weights'
    },
    {
        'order': 12,
        'type': 'sentence_completion',
        'text': 'Atomic clocks measure the __________ signal produced by electrons in atoms.',
        'answer': 'microwave'
    },
    {
        'order': 13,
        'type': 'sentence_completion',
        'text': 'Modern atomic clocks could run for 13.8 billion years without losing a single __________.',
        'answer': 'second'
    }
]

# Create Passage 1 questions
for q_data in questions_1_5:
    IELTSQuestion.objects.create(
        exam=reading_exam,
        question_type=q_data['type'],
        order=q_data['order'],
        passage_text=passage_1_text,
        question_text=q_data['text'],
        options=q_data['options'],
        correct_answer=[q_data['answer']],
        points=Decimal('1.0')
    )

for q_data in questions_6_9:
    IELTSQuestion.objects.create(
        exam=reading_exam,
        question_type=q_data['type'],
        order=q_data['order'],
        passage_text=passage_1_text,
        question_text=q_data['text'],
        correct_answer=q_data['answer'],
        points=Decimal('1.0')
    )

for q_data in questions_10_13:
    IELTSQuestion.objects.create(
        exam=reading_exam,
        question_type=q_data['type'],
        order=q_data['order'],
        passage_text=passage_1_text,
        question_text=q_data['text'],
        correct_answer=q_data['answer'],
        points=Decimal('1.0')
    )

print(f"  ✓ Created Passage 1: {13} questions (Multiple Choice, T/F/NG, Sentence Completion)")

# PASSAGE 2: The Throw-Away Culture (Academic - Society/Environment)
passage_2_text = """The Throw-Away Culture

Modern consumer society is characterized by a 'throw-away culture' where products are designed for short-term use and rapid replacement. This phenomenon has accelerated dramatically over the past few decades, driven by technological advancement, changing consumer expectations, and economic incentives that favor new purchases over repairs.

The electronics industry provides a stark example of this trend. Smartphones, which have become essential tools in daily life, are typically replaced every 18-24 months, even though they remain functionally adequate. Manufacturers contribute to this cycle through planned obsolescence - deliberately designing products with limited lifespans. They achieve this through non-replaceable batteries, proprietary parts, and software updates that slow down older devices. When a product does break, repair costs often approach or exceed the price of a new item, making replacement the economically rational choice.

This disposability extends far beyond electronics. The fashion industry has pioneered 'fast fashion,' producing trendy clothing at rock-bottom prices with quality so poor that garments are designed to last a single season. Furniture, appliances, and even vehicles are increasingly built for replacement rather than repair. The average washing machine in the 1970s lasted 20 years; today's models typically fail within 7-10 years.

The environmental consequences are staggering. Electronic waste, or e-waste, is the fastest-growing waste stream globally, with approximately 50 million tonnes generated annually. Less than 20% is formally recycled, with the remainder ending up in landfills or being illegally shipped to developing nations. These discarded devices contain toxic materials including lead, mercury, and cadmium, which leach into soil and groundwater. The production of replacement goods consumes vast amounts of energy and raw materials, contributing significantly to carbon emissions and resource depletion.

However, a counter-movement is emerging. The 'right to repair' campaign advocates for legislation requiring manufacturers to make spare parts, tools, and repair information available to consumers and independent repair shops. Several jurisdictions, including the European Union and some U.S. states, have begun implementing such laws. Additionally, a growing number of consumers are embracing minimalism and prioritizing durability over novelty. Repair cafés, where volunteers help people fix broken items, have sprung up in communities worldwide. Companies like Patagonia have built successful brands around repairability and longevity, demonstrating that sustainability can align with profitability.

Whether these efforts can reverse the throw-away culture remains to be seen, but they represent important steps toward a more sustainable relationship between consumers and the products they use."""

# PASSAGE 2 QUESTIONS (Questions 14-27)

# Questions 14-19: Matching Headings
paragraph_headings = [
    'i. The rise of electronic waste',
    'ii. Economic factors driving replacement',
    'iii. Defining the throw-away culture',
    'iv. Fashion industry innovations',
    'v. Legislative responses to disposability',
    'vi. Historical comparison of product durability',
    'vii. Environmental impact of disposal',
    'viii. Movements toward sustainability'
]

questions_14_19 = [
    {'order': 14, 'text': 'Paragraph 1', 'answer': 'iii. Defining the throw-away culture'},
    {'order': 15, 'text': 'Paragraph 2', 'answer': 'ii. Economic factors driving replacement'},
    {'order': 16, 'text': 'Paragraph 3', 'answer': 'vi. Historical comparison of product durability'},
    {'order': 17, 'text': 'Paragraph 4', 'answer': 'vii. Environmental impact of disposal'},
    {'order': 18, 'text': 'Paragraph 5', 'answer': 'viii. Movements toward sustainability'},
    {'order': 19, 'text': 'Paragraph 6', 'answer': 'v. Legislative responses to disposability'}
]

# Questions 20-23: Multiple Choice
questions_20_23 = [
    {
        'order': 20,
        'type': 'multiple_choice',
        'text': 'According to the passage, smartphones are typically replaced because',
        'options': ['A) they become completely unusable', 'B) batteries cannot be replaced', 'C) repair costs are too high', 'D) all of the above'],
        'answer': 'D) all of the above'
    },
    {
        'order': 21,
        'type': 'multiple_choice',
        'text': 'The passage states that fast fashion clothing is designed to',
        'options': ['A) be recycled after use', 'B) last for one season', 'C) appeal to luxury markets', 'D) reduce manufacturing costs'],
        'answer': 'B) last for one season'
    },
    {
        'order': 22,
        'type': 'multiple_choice',
        'text': 'What percentage of e-waste is formally recycled?',
        'options': ['A) Less than 10%', 'B) Less than 20%', 'C) Around 50%', 'D) More than 70%'],
        'answer': 'B) Less than 20%'
    },
    {
        'order': 23,
        'type': 'multiple_choice',
        'text': 'The right to repair movement seeks to',
        'options': ['A) ban planned obsolescence', 'B) require manufacturers to provide repair resources', 'C) eliminate electronic waste', 'D) reduce product prices'],
        'answer': 'B) require manufacturers to provide repair resources'
    }
]

# Questions 24-27: Summary Completion
questions_24_27 = [
    {
        'order': 24,
        'type': 'summary_completion',
        'text': 'Modern products are often designed with __________ obsolescence, meaning they have deliberately limited lifespans.',
        'answer': 'planned'
    },
    {
        'order': 25,
        'type': 'summary_completion',
        'text': 'E-waste contains dangerous substances such as lead, mercury, and __________, which contaminate the environment.',
        'answer': 'cadmium'
    },
    {
        'order': 26,
        'type': 'summary_completion',
        'text': '__________ cafés provide community spaces where volunteers help repair broken items.',
        'answer': 'Repair'
    },
    {
        'order': 27,
        'type': 'summary_completion',
        'text': 'The company __________ has built a successful business model based on product durability and repairability.',
        'answer': 'Patagonia'
    }
]

# Create Passage 2 questions
for q_data in questions_14_19:
    IELTSQuestion.objects.create(
        exam=reading_exam,
        question_type='matching_headings',
        order=q_data['order'],
        passage_text=passage_2_text,
        question_text=q_data['text'],
        options=paragraph_headings,
        correct_answer=q_data['answer'],
        points=Decimal('1.0')
    )

for q_data in questions_20_23:
    IELTSQuestion.objects.create(
        exam=reading_exam,
        question_type=q_data['type'],
        order=q_data['order'],
        passage_text=passage_2_text,
        question_text=q_data['text'],
        options=q_data['options'],
        correct_answer=[q_data['answer']],
        points=Decimal('1.0')
    )

for q_data in questions_24_27:
    IELTSQuestion.objects.create(
        exam=reading_exam,
        question_type=q_data['type'],
        order=q_data['order'],
        passage_text=passage_2_text,
        question_text=q_data['text'],
        correct_answer=q_data['answer'],
        points=Decimal('1.0')
    )

print(f"  ✓ Created Passage 2: {14} questions (Matching Headings, Multiple Choice, Summary Completion)")

# PASSAGE 3: Wildlife Conservation Funding (Academic - Environment/Economics)
passage_3_text = """Wildlife Conservation Funding: A Global Perspective

The allocation of resources for wildlife protection has become an increasingly contentious issue as biodiversity loss accelerates worldwide. Conservation efforts require substantial financial investment, yet funding mechanisms vary dramatically across regions and species, raising important questions about efficiency and equity.

Traditional conservation funding has relied heavily on governmental budgets and charitable donations. However, these sources have proven inadequate to meet growing conservation needs. The United Nations estimates that protecting Earth's biodiversity requires approximately $300-400 billion annually, yet current spending reaches only $52 billion per year. This massive funding gap has prompted conservationists to explore innovative financing mechanisms.

One promising approach is payment for ecosystem services (PES), where beneficiaries of environmental services compensate those who provide them. Costa Rica's pioneering PES program pays landowners to maintain forests, which provide watershed protection, carbon sequestration, and biodiversity habitat. Since its inception in 1997, the program has reversed deforestation trends and generated revenue for rural communities. Similar schemes have emerged globally, from China's Grain-to-Green program to Kenya's Northern Rangelands Trust.

Conservation finance has also embraced market-based instruments. Conservation trust funds pool donations and invest them, using the investment returns to fund ongoing conservation work. The Bhutan Trust Fund for Environmental Conservation, established in 1991, has generated over $15 million for protected area management. Debt-for-nature swaps allow countries to reduce their foreign debt in exchange for commitments to conservation. Since the first swap in 1987, these arrangements have mobilized over $1 billion for conservation globally.

Ecotourism represents another significant revenue stream, generating an estimated $600 billion annually worldwide. When properly managed, wildlife viewing and nature-based tourism create economic incentives for conservation while providing employment for local communities. Rwanda's mountain gorilla tourism has generated over $400 million since 2005, with revenue sharing schemes ensuring that local communities benefit directly. However, ecotourism also poses risks, including habitat disturbance, wildlife stress, and dependency on volatile tourism markets, as demonstrated by the COVID-19 pandemic's devastating impact on conservation funding.

Private sector engagement in conservation has expanded dramatically. Many corporations now recognize that their operations depend on ecosystem services and face reputational risks from environmental degradation. Some have established corporate foundations dedicated to conservation, while others have integrated biodiversity considerations into their supply chain management. However, critics warn of 'greenwashing,' where companies exaggerate their environmental commitments while continuing harmful practices.

The challenge moving forward is not merely to increase total conservation funding, but to allocate resources more strategically. Current spending is heavily skewed toward charismatic megafauna in developed nations, while overlooked ecosystems and less photogenic species receive insufficient attention. The deep ocean, for instance, hosts extraordinary biodiversity but receives less than 1% of conservation funding. Similarly, invertebrates constitute over 95% of animal species but receive a tiny fraction of conservation resources.

Addressing these imbalances requires both increased funding and improved allocation mechanisms. Some experts advocate for systematic conservation planning that prioritizes areas based on biodiversity value, threat level, and cost-effectiveness rather than public appeal. Others emphasize the importance of securing land rights for indigenous communities, who manage territories containing 80% of Earth's remaining biodiversity despite representing only 5% of the global population. Whatever approaches ultimately prevail, the urgency of the biodiversity crisis demands immediate action and substantial investment."""

# PASSAGE 3 QUESTIONS (Questions 28-40)

# Questions 28-32: Multiple Choice
questions_28_32 = [
    {
        'order': 28,
        'type': 'multiple_choice',
        'text': 'What is the current annual funding gap for biodiversity protection?',
        'options': ['A) $52 billion', 'B) $248-348 billion', 'C) $300-400 billion', 'D) $600 billion'],
        'answer': 'B) $248-348 billion'
    },
    {
        'order': 29,
        'type': 'multiple_choice',
        'text': 'Payment for ecosystem services programs reward landowners for',
        'options': ['A) developing their land commercially', 'B) providing environmental benefits', 'C) participating in research studies', 'D) relocating to urban areas'],
        'answer': 'B) providing environmental benefits'
    },
    {
        'order': 30,
        'type': 'multiple_choice',
        'text': 'The primary advantage of conservation trust funds is that they',
        'options': ['A) require no initial investment', 'B) provide immediate large payments', 'C) generate ongoing revenue through investments', 'D) eliminate the need for government funding'],
        'answer': 'C) generate ongoing revenue through investments'
    },
    {
        'order': 31,
        'type': 'multiple_choice',
        'text': 'The COVID-19 pandemic demonstrated that ecotourism',
        'options': ['A) is more profitable than traditional conservation funding', 'B) can be vulnerable to external shocks', 'C) has no impact on wildlife populations', 'D) should be banned in sensitive areas'],
        'answer': 'B) can be vulnerable to external shocks'
    },
    {
        'order': 32,
        'type': 'multiple_choice',
        'text': 'According to the passage, indigenous communities',
        'options': ['A) manage most of Earth\'s remaining biodiversity', 'B) receive the majority of conservation funding', 'C) represent 80% of the global population', 'D) oppose systematic conservation planning'],
        'answer': 'A) manage most of Earth\'s remaining biodiversity'
    }
]

# Questions 33-36: True/False/Not Given
questions_33_36 = [
    {
        'order': 33,
        'type': 'true_false_notgiven',
        'text': 'Costa Rica\'s PES program has been operating for over 20 years.',
        'answer': 'True'
    },
    {
        'order': 34,
        'type': 'true_false_notgiven',
        'text': 'Debt-for-nature swaps have generated more funding than ecotourism.',
        'answer': 'False'
    },
    {
        'order': 35,
        'type': 'true_false_notgiven',
        'text': 'All corporate conservation initiatives are examples of greenwashing.',
        'answer': 'False'
    },
    {
        'order': 36,
        'type': 'true_false_notgiven',
        'text': 'The deep ocean receives adequate conservation funding relative to its biodiversity.',
        'answer': 'False'
    }
]

# Questions 37-40: Sentence Completion
questions_37_40 = [
    {
        'order': 37,
        'type': 'sentence_completion',
        'text': 'The UN estimates that protecting global biodiversity requires $300-400 billion __________ .',
        'answer': 'annually'
    },
    {
        'order': 38,
        'type': 'sentence_completion',
        'text': 'Rwanda has earned over $400 million from mountain __________ tourism.',
        'answer': 'gorilla'
    },
    {
        'order': 39,
        'type': 'sentence_completion',
        'text': 'Critics warn that some companies engage in __________, exaggerating their environmental commitments.',
        'answer': 'greenwashing'
    },
    {
        'order': 40,
        'type': 'sentence_completion',
        'text': 'Invertebrates make up over 95% of animal species but receive __________ conservation funding.',
        'answer': 'insufficient'
    }
]

# Create Passage 3 questions
for q_data in questions_28_32:
    IELTSQuestion.objects.create(
        exam=reading_exam,
        question_type=q_data['type'],
        order=q_data['order'],
        passage_text=passage_3_text,
        question_text=q_data['text'],
        options=q_data['options'],
        correct_answer=[q_data['answer']],
        points=Decimal('1.0')
    )

for q_data in questions_33_36:
    IELTSQuestion.objects.create(
        exam=reading_exam,
        question_type=q_data['type'],
        order=q_data['order'],
        passage_text=passage_3_text,
        question_text=q_data['text'],
        correct_answer=q_data['answer'],
        points=Decimal('1.0')
    )

for q_data in questions_37_40:
    IELTSQuestion.objects.create(
        exam=reading_exam,
        question_type=q_data['type'],
        order=q_data['order'],
        passage_text=passage_3_text,
        question_text=q_data['text'],
        correct_answer=q_data['answer'],
        points=Decimal('1.0')
    )

print(f"  ✓ Created Passage 3: {13} questions (Multiple Choice, T/F/NG, Sentence Completion)")
print(f"  ✓ Reading section complete: 40 questions total")

# ============================================================================
# SECTION 2: LISTENING (30 minutes, 40 questions)
# ============================================================================

print("\n[2/4] Creating IELTS Listening Section...")

# Delete existing listening exam if it exists
IELTSExam.objects.filter(section='listening').delete()

listening_exam = IELTSExam.objects.create(
    section='listening',
    title='IELTS Listening Practice Test 1',
    description='Complete listening test with 4 sections covering everyday conversations, monologues, academic discussions, and lectures. Tests ability to understand main ideas, specific information, opinions, and attitudes.',
    coin_cost=50,
    coin_refund=10,
    time_limit_minutes=30,
    passing_band_score=Decimal('5.0'),
    instructions='''INSTRUCTIONS TO CANDIDATES

• Answer all questions
• You will hear each recording ONCE only
• You have 30 minutes to complete this test
• Write your answers on the answer sheet
• Use a pencil (you may use a pen but it is not recommended)
• Check your spelling carefully

INFORMATION FOR CANDIDATES

• There are 40 questions in this test
• Each question carries 1 mark
• The test has 4 sections
• You will hear each section once only
• You will have time to read the questions before each section
• At the end of the test, you will have 10 minutes to transfer your answers''',
    is_active=True
)

# SECTION 1: Conversation about renting an apartment (Questions 1-10)
listening_part1_transcript = """SECTION 1

You will hear a conversation between a student and a landlord about renting an apartment.

[Phone rings]

Landlord: Hello, Green Valley Rentals. This is David speaking. How can I help you?

Student: Oh hi, I'm calling about the apartment you have available for rent. I saw the listing online. Is it still available?

Landlord: Yes, it is. The apartment on Maple Street, correct?

Student: That's the one. Could you tell me a bit more about it?

Landlord: Of course. It's a two-bedroom apartment on the third floor. It has a living room, kitchen, bathroom, and a small balcony overlooking the park.

Student: That sounds lovely. How large is it?

Landlord: About 75 square meters in total. The bedrooms are roughly equal in size, about 12 square meters each.

Student: Perfect. And what's the monthly rent?

Landlord: It's £850 per month, and that includes water and heating. However, electricity and internet are separate, so you'd need to set those up yourself.

Student: I see. Is there parking available?

Landlord: Yes, there's one parking space included, underground. If you need a second space, that's an extra £40 per month.

Student: One space should be fine. What about pets? I have a small cat.

Landlord: Pets are allowed, but there's a £200 refundable pet deposit in addition to the standard deposit.

Student: Okay. Speaking of which, what's the total deposit required?

Landlord: The standard deposit is one and a half months' rent, so that would be £1,275, plus the £200 pet deposit if you have your cat. So £1,475 total.

Student: And when is the apartment available from?

Landlord: It's available from the 1st of March. The current tenants are moving out at the end of February.

Student: That's actually perfect timing for me. I'd like to arrange a viewing if possible.

Landlord: Certainly. I have availability this Thursday at 3 PM or Saturday at 11 AM. Which works better for you?

Student: Thursday at 3 works well for me.

Landlord: Great. Let me just take down your details. What's your full name?

Student: It's Sarah Mitchell. M-I-T-C-H-E-L-L.

Landlord: And your phone number?

Student: It's 07700 954321.

Landlord: Perfect. And may I ask where you're currently living and why you're looking to move?

Student: I'm currently staying in student housing at the university, but I'm starting a PhD program and need more space for studying. Plus, I'd like somewhere quieter.

Landlord: That makes sense. Well, I think you'll find this apartment quite peaceful. It's in a residential area, and the neighbors are very quiet. The park across the street is lovely too.

Student: That sounds ideal. I'm looking forward to seeing it on Thursday.

Landlord: Excellent. I'll see you then at 3 PM. The address is 42 Maple Street. Just ring the buzzer for apartment 3B.

Student: Got it. Thank you so much!

Landlord: You're welcome, Sarah. See you Thursday."""

# Part 1 Questions (Form Completion)
part1_questions = [
    {'order': 1, 'text': 'Apartment address: 42 __________ Street', 'answer': 'Maple'},
    {'order': 2, 'text': 'Apartment size: __________ square meters', 'answer': '75'},
    {'order': 3, 'text': 'Monthly rent: £__________', 'answer': '850'},
    {'order': 4, 'text': 'Rent includes: water and __________', 'answer': 'heating'},
    {'order': 5, 'text': 'Additional parking space costs: £__________ per month', 'answer': '40'},
    {'order': 6, 'text': 'Pet deposit: £__________', 'answer': '200'},
    {'order': 7, 'text': 'Total deposit required: £__________', 'answer': '1475'},
    {'order': 8, 'text': 'Available from: 1st of __________', 'answer': 'March'},
    {'order': 9, 'text': 'Viewing scheduled for: __________ at 3 PM', 'answer': 'Thursday'},
    {'order': 10, 'text': 'Student\'s surname: __________', 'answer': 'Mitchell'}
]

for q in part1_questions:
    IELTSQuestion.objects.create(
        exam=listening_exam,
        question_type='form_completion',
        order=q['order'],
        passage_text=listening_part1_transcript,
        question_text=q['text'],
        correct_answer=q['answer'],
        points=Decimal('1.0'),
        audio_file=None  # In production, would link to actual audio file
    )

print(f"  ✓ Created Part 1: 10 questions (Form Completion - Apartment Rental)")

# SECTION 2: Monologue about a museum tour (Questions 11-20)
listening_part2_transcript = """SECTION 2

You will hear a tour guide giving information about a museum.

Good morning everyone, and welcome to the National Science Museum. My name is James, and I'll be your guide for today's tour. Before we begin, I'd like to give you some important information about our facilities and what you'll see today.

First, a few practical matters. The museum has four floors, and we'll be visiting three of them during our two-hour tour. The fourth floor is currently closed for renovation and will reopen next month with an exciting new exhibition on space exploration. Please stay with the group during the tour, and feel free to ask questions at any time.

Now, let's talk about what you'll see. We'll start on the ground floor in the Natural History Gallery. This is our most popular exhibition, featuring dinosaur fossils that are over 65 million years old. The star attraction is our complete Tyrannosaurus Rex skeleton, which was discovered in Montana in 1990. We also have interactive displays about evolution and biodiversity.

After the Natural History Gallery, we'll move to the first floor to visit the Technology Through the Ages exhibition. Here, you'll see how human innovation has evolved from the invention of the wheel to modern computers. We have working models of early steam engines, the first telephone invented by Alexander Graham Bell, and even one of the original Apple computers from 1976. This exhibition is particularly popular with school groups.

Our next stop will be the second floor, where we have two galleries. The first is the Human Body Gallery, which uses state-of-the-art models and virtual reality to teach visitors about anatomy and physiology. You can even walk through a giant model of the human heart. The second gallery on this floor is dedicated to Environmental Science, featuring exhibits on climate change, renewable energy, and conservation efforts.

We won't be visiting the third floor today as it contains our research facilities and offices, but I should mention that we do offer special behind-the-scenes tours twice a month where you can see our scientists at work.

The museum café is located on the ground floor, next to the gift shop. It serves hot and cold beverages, sandwiches, and snacks. The gift shop sells educational toys, books, and souvenirs. Both are open until 6 PM, even though the museum closes at 5:30 PM, giving you time to browse after your visit.

For those of you with children, we have a Family Discovery Center on the ground floor with hands-on activities designed for ages 3 to 12. There's also a dedicated nursing room for parents with infants.

Before we begin, please note that photography is allowed in all galleries except the Natural History Gallery, where flash photography could damage the ancient fossils. You're welcome to take photos elsewhere, and we encourage you to share them on social media using our hashtag.

Now, if everyone's ready, let's head to the Natural History Gallery to begin our tour!"""

# Part 2 Questions (Multiple Choice + Table Completion)
part2_questions = [
    # Questions 11-14: Multiple Choice
    {
        'order': 11,
        'type': 'multiple_choice',
        'text': 'How long is the museum tour?',
        'options': ['A) One hour', 'B) Two hours', 'C) Three hours', 'D) Four hours'],
        'answer': 'B) Two hours'
    },
    {
        'order': 12,
        'type': 'multiple_choice',
        'text': 'Why is the fourth floor closed?',
        'options': ['A) Staff shortage', 'B) Renovation work', 'C) Temporary exhibition', 'D) Maintenance'],
        'answer': 'B) Renovation work'
    },
    {
        'order': 13,
        'type': 'multiple_choice',
        'text': 'Where was the T-Rex skeleton discovered?',
        'options': ['A) Montana', 'B) Texas', 'C) California', 'D) Colorado'],
        'answer': 'A) Montana'
    },
    {
        'order': 14,
        'type': 'multiple_choice',
        'text': 'What time does the gift shop close?',
        'options': ['A) 5:00 PM', 'B) 5:30 PM', 'C) 6:00 PM', 'D) 6:30 PM'],
        'answer': 'C) 6:00 PM'
    },
    # Questions 15-20: Note Completion
    {
        'order': 15,
        'type': 'note_completion',
        'text': 'Ground Floor: Natural History Gallery and __________ Discovery Center',
        'answer': 'Family'
    },
    {
        'order': 16,
        'type': 'note_completion',
        'text': 'First Floor: __________ Through the Ages exhibition',
        'answer': 'Technology'
    },
    {
        'order': 17,
        'type': 'note_completion',
        'text': 'Second Floor: Human Body Gallery and __________ Science',
        'answer': 'Environmental'
    },
    {
        'order': 18,
        'type': 'note_completion',
        'text': 'Special behind-the-scenes tours: __________ a month',
        'answer': 'twice'
    },
    {
        'order': 19,
        'type': 'note_completion',
        'text': 'Photography restrictions: No flash in __________ Gallery',
        'answer': 'Natural History'
    },
    {
        'order': 20,
        'type': 'note_completion',
        'text': 'Apple computer in exhibition from year: __________',
        'answer': '1976'
    }
]

for q in part2_questions:
    if 'options' in q:
        IELTSQuestion.objects.create(
            exam=listening_exam,
            question_type=q['type'],
            order=q['order'],
            passage_text=listening_part2_transcript,
            question_text=q['text'],
            options=q['options'],
            correct_answer=[q['answer']],
            points=Decimal('1.0'),
            audio_file=None
        )
    else:
        IELTSQuestion.objects.create(
            exam=listening_exam,
            question_type=q['type'],
            order=q['order'],
            passage_text=listening_part2_transcript,
            question_text=q['text'],
            correct_answer=q['answer'],
            points=Decimal('1.0'),
            audio_file=None
        )

print(f"  ✓ Created Part 2: 10 questions (Multiple Choice + Note Completion - Museum Tour)")

# SECTION 3: Discussion about university assignment (Questions 21-30)
listening_part3_transcript = """SECTION 3

You will hear two students, Emma and Tom, discussing their university assignment with their tutor, Dr. Richards.

Dr. Richards: Good afternoon, Emma and Tom. Thanks for coming to see me. I wanted to discuss your progress on the group project about sustainable urban development.

Emma: Thanks for making time, Dr. Richards. We've made quite a bit of progress, actually.

Tom: Yes, we've completed the literature review section and we're now working on the case studies.

Dr. Richards: Excellent. How many case studies are you planning to include?

Emma: We initially thought three would be sufficient, but after our preliminary research, we think four would give us a more comprehensive analysis.

Dr. Richards: Four sounds reasonable, but remember you have a word limit of 5,000 words for the entire paper. Make sure you don't compromise the depth of analysis by trying to cover too much.

Tom: That's a good point. We were actually concerned about that. Do you think we should reduce it back to three?

Dr. Richards: Not necessarily. If you can make four work within the word limit while maintaining quality, go for it. But be strategic about what you include.

Emma: Okay. We've chosen Copenhagen, Singapore, and Vancouver as our first three cities. They're all recognized as leaders in sustainability.

Dr. Richards: Good choices. What's your fourth city?

Tom: We were debating between Melbourne and Portland. Both have interesting approaches, but we're leaning toward Portland because it has more innovative transportation policies.

Dr. Richards: Portland's a solid choice, especially for transportation. Have you considered looking at a city from the Global South? It might add an interesting dimension to your analysis.

Emma: That's actually a really good suggestion. We hadn't thought about that. Maybe Curitiba in Brazil? I've read about their bus rapid transit system.

Dr. Richards: Curitiba would be perfect. Their BRT system has been replicated in cities worldwide. It would provide a nice contrast to the other cities, especially in terms of budget constraints and resource management.

Tom: Great, we'll add that. Now, about the methodology section - we're planning to use both quantitative and qualitative data. Is that appropriate?

Dr. Richards: Absolutely. Mixed methods are very appropriate for this kind of comparative study. What specific metrics are you considering?

Emma: For quantitative data, we're looking at carbon emissions per capita, percentage of renewable energy use, public transport ridership rates, and green space per resident.

Tom: And for qualitative analysis, we'll examine policy frameworks, stakeholder interviews from published sources, and urban planning strategies.

Dr. Richards: That sounds comprehensive. Just make sure you explain clearly why you chose those particular metrics and how they relate to your research questions.

Emma: Will do. One challenge we're facing is finding comparable data across all cities. The time periods don't always match up.

Dr. Richards: That's a common issue in comparative research. Document any discrepancies clearly in your methodology section and explain how you addressed them. Sometimes you might need to use the most recent data available for each city, even if it's not from the same year.

Tom: That makes sense. Oh, and we wanted to ask about the structure. Should we analyze each city separately and then compare, or integrate the comparison throughout?

Dr. Richards: Either approach can work, but I'd recommend analyzing each city in its own section first, then having a dedicated comparison and discussion section at the end. It makes it easier for readers to follow.

Emma: Perfect. When's our next checkpoint? We want to make sure we're staying on track.

Dr. Richards: Let's meet again in three weeks. By then, you should have completed at least two of the case studies. Bring drafts and we'll review them together.

Tom: Sounds good. Thanks so much for your guidance.

Dr. Richards: You're welcome. I'm impressed with your progress. Keep up the good work!"""

# Part 3 Questions
part3_questions = [
    # Questions 21-24: Multiple Choice
    {
        'order': 21,
        'type': 'multiple_choice',
        'text': 'What have Emma and Tom already completed?',
        'options': ['A) The entire project', 'B) The literature review', 'C) The case studies', 'D) The methodology'],
        'answer': 'B) The literature review'
    },
    {
        'order': 22,
        'type': 'multiple_choice',
        'text': 'What is the word limit for their paper?',
        'options': ['A) 3,000 words', 'B) 4,000 words', 'C) 5,000 words', 'D) 6,000 words'],
        'answer': 'C) 5,000 words'
    },
    {
        'order': 23,
        'type': 'multiple_choice',
        'text': 'Why do the students prefer Portland over Melbourne?',
        'options': ['A) Lower cost of living', 'B) Better climate data', 'C) Innovative transportation policies', 'D) Larger population'],
        'answer': 'C) Innovative transportation policies'
    },
    {
        'order': 24,
        'type': 'multiple_choice',
        'text': 'What city from the Global South did Dr. Richards recommend?',
        'options': ['A) São Paulo', 'B) Curitiba', 'C) Buenos Aires', 'D) Lima'],
        'answer': 'B) Curitiba'
    },
    # Questions 25-30: Sentence Completion
    {
        'order': 25,
        'type': 'sentence_completion',
        'text': 'The students plan to use both __________ and qualitative data.',
        'answer': 'quantitative'
    },
    {
        'order': 26,
        'type': 'sentence_completion',
        'text': 'One quantitative metric is carbon emissions per __________.',
        'answer': 'capita'
    },
    {
        'order': 27,
        'type': 'sentence_completion',
        'text': 'A challenge is finding __________ data across all cities.',
        'answer': 'comparable'
    },
    {
        'order': 28,
        'type': 'sentence_completion',
        'text': 'Students should analyze each city __________ before comparing.',
        'answer': 'separately'
    },
    {
        'order': 29,
        'type': 'sentence_completion',
        'text': 'The next checkpoint meeting is scheduled for __________ weeks.',
        'answer': 'three'
    },
    {
        'order': 30,
        'type': 'sentence_completion',
        'text': 'By the next meeting, students should complete at least __________ case studies.',
        'answer': 'two'
    }
]

for q in part3_questions:
    if 'options' in q:
        IELTSQuestion.objects.create(
            exam=listening_exam,
            question_type=q['type'],
            order=q['order'],
            passage_text=listening_part3_transcript,
            question_text=q['text'],
            options=q['options'],
            correct_answer=[q['answer']],
            points=Decimal('1.0'),
            audio_file=None
        )
    else:
        IELTSQuestion.objects.create(
            exam=listening_exam,
            question_type=q['type'],
            order=q['order'],
            passage_text=listening_part3_transcript,
            question_text=q['text'],
            correct_answer=q['answer'],
            points=Decimal('1.0'),
            audio_file=None
        )

print(f"  ✓ Created Part 3: 10 questions (Multiple Choice + Sentence Completion - Academic Discussion)")

# SECTION 4: Academic lecture about artificial intelligence (Questions 31-40)
listening_part4_transcript = """SECTION 4

You will hear a lecture about artificial intelligence in healthcare.

Good evening. Tonight's lecture focuses on artificial intelligence applications in healthcare, a field that's experiencing rapid transformation. I'll examine three key areas where AI is making significant impact: diagnostic imaging, drug discovery, and personalized medicine.

Let's begin with diagnostic imaging. AI systems, particularly those using deep learning algorithms, have demonstrated remarkable accuracy in analyzing medical images. In radiology, AI can detect abnormalities in X-rays, CT scans, and MRIs with accuracy rates that often match or exceed those of experienced radiologists. For instance, Google's AI system can identify diabetic retinopathy in retinal scans with 90% accuracy, comparable to ophthalmologists with decades of experience.

The advantages extend beyond accuracy. AI systems can process images in seconds, dramatically reducing the time patients wait for results. This speed is particularly crucial in emergency situations, such as stroke diagnosis, where every minute counts. Moreover, AI can work continuously without fatigue, helping to address radiologist shortages in many countries.

However, we must acknowledge the limitations. AI systems are only as good as the data they're trained on. If training data lacks diversity - for example, if it contains primarily images from one demographic group - the AI may perform poorly on underrepresented populations. This raises serious equity concerns that researchers are actively working to address.

Moving to drug discovery, AI is revolutionizing pharmaceutical development. Traditional drug development takes approximately 10 to 15 years and costs over $2 billion per drug. AI can accelerate this process significantly by predicting how different molecular structures will interact with disease targets. Machine learning algorithms can screen millions of potential compounds in days, identifying promising candidates for further testing.

Several AI-discovered drugs are now in clinical trials. For example, an AI system designed a drug for obsessive-compulsive disorder in just 12 months, a process that would typically take four to five years. Another AI platform identified a novel antibiotic effective against drug-resistant bacteria, one of the most pressing challenges in modern medicine.

The third application is personalized medicine, where AI analyzes individual patient data to customize treatment plans. By processing genetic information, medical history, lifestyle factors, and real-time health monitoring data, AI systems can predict which treatments will be most effective for specific patients. This approach contrasts sharply with traditional medicine's one-size-fits-all model.

In oncology, AI helps oncologists select optimal chemotherapy regimens by analyzing tumor genetic profiles. This can spare patients from ineffective treatments with serious side effects while increasing the likelihood of positive outcomes. Similarly, in psychiatry, AI algorithms predict individual responses to antidepressants, helping doctors choose the most appropriate medication faster.

Despite these advances, implementation faces several obstacles. First, there's the regulatory challenge. Medical AI systems require rigorous validation before clinical use, but current regulatory frameworks weren't designed for algorithms that continuously learn and evolve. Regulators worldwide are developing new guidelines, but this process takes time.

Second, there's the question of liability. If an AI system makes a diagnostic error, who is responsible - the algorithm developer, the healthcare provider using it, or the institution? These legal questions remain largely unresolved.

Third, there are concerns about data privacy. AI systems require vast amounts of patient data for training and operation. Ensuring this data is protected while allowing beneficial AI development requires careful balancing of innovation and privacy rights.

Looking ahead, the integration of AI in healthcare seems inevitable. The potential benefits - improved accuracy, faster diagnoses, accelerated drug development, and personalized treatments - are simply too significant to ignore. However, realizing this potential while addressing ethical, legal, and technical challenges will require collaboration among technologists, healthcare professionals, policymakers, and patients themselves.

The goal isn't to replace human healthcare providers but to augment their capabilities, allowing them to focus on aspects of care that require human judgment, empathy, and creativity. Used wisely, AI could help us create a healthcare system that's more effective, more efficient, and more equitable than ever before. Thank you."""

# Part 4 Questions
part4_questions = [
    # Questions 31-36: Sentence Completion
    {
        'order': 31,
        'type': 'sentence_completion',
        'text': 'AI can detect abnormalities in medical images with __________ that matches expert radiologists.',
        'answer': 'accuracy'
    },
    {
        'order': 32,
        'type': 'sentence_completion',
        'text': 'Google\'s AI identifies diabetic retinopathy with __________ % accuracy.',
        'answer': '90'
    },
    {
        'order': 33,
        'type': 'sentence_completion',
        'text': 'Traditional drug development costs over __________ billion dollars per drug.',
        'answer': '2'
    },
    {
        'order': 34,
        'type': 'sentence_completion',
        'text': 'An AI system designed an OCD drug in just __________ months.',
        'answer': '12'
    },
    {
        'order': 35,
        'type': 'sentence_completion',
        'text': 'In oncology, AI analyzes tumor __________ profiles to select treatments.',
        'answer': 'genetic'
    },
    {
        'order': 36,
        'type': 'sentence_completion',
        'text': 'Current __________ frameworks weren\'t designed for continuously learning algorithms.',
        'answer': 'regulatory'
    },
    # Questions 37-40: Multiple Choice
    {
        'order': 37,
        'type': 'multiple_choice',
        'text': 'What is a major limitation of AI diagnostic systems?',
        'options': ['A) They are too slow', 'B) They cost too much', 'C) They may have bias in training data', 'D) They require too much electricity'],
        'answer': 'C) They may have bias in training data'
    },
    {
        'order': 38,
        'type': 'multiple_choice',
        'text': 'How long does traditional drug development typically take?',
        'options': ['A) 2-5 years', 'B) 5-8 years', 'C) 10-15 years', 'D) 15-20 years'],
        'answer': 'C) 10-15 years'
    },
    {
        'order': 39,
        'type': 'multiple_choice',
        'text': 'According to the lecture, the goal of AI in healthcare is to',
        'options': ['A) replace all doctors', 'B) reduce healthcare costs', 'C) augment healthcare providers\' capabilities', 'D) eliminate medical errors'],
        'answer': 'C) augment healthcare providers\' capabilities'
    },
    {
        'order': 40,
        'type': 'multiple_choice',
        'text': 'What is mentioned as an unresolved issue with medical AI?',
        'options': ['A) Accuracy rates', 'B) Processing speed', 'C) Cost of development', 'D) Legal liability'],
        'answer': 'D) Legal liability'
    }
]

for q in part4_questions:
    if 'options' in q:
        IELTSQuestion.objects.create(
            exam=listening_exam,
            question_type=q['type'],
            order=q['order'],
            passage_text=listening_part4_transcript,
            question_text=q['text'],
            options=q['options'],
            correct_answer=[q['answer']],
            points=Decimal('1.0'),
            audio_file=None
        )
    else:
        IELTSQuestion.objects.create(
            exam=listening_exam,
            question_type=q['type'],
            order=q['order'],
            passage_text=listening_part4_transcript,
            question_text=q['text'],
            correct_answer=q['answer'],
            points=Decimal('1.0'),
            audio_file=None
        )

print(f"  ✓ Created Part 4: 10 questions (Sentence Completion + Multiple Choice - Academic Lecture)")
print(f"  ✓ Listening section complete: 40 questions total")

# ============================================================================
# SECTION 3: WRITING (60 minutes, 2 tasks)
# ============================================================================

print("\n[3/4] Creating IELTS Writing Section...")

# Delete existing writing exam if it exists
IELTSExam.objects.filter(section='writing').delete()

writing_exam = IELTSExam.objects.create(
    section='writing',
    title='IELTS Academic Writing Practice Test 1',
    description='Academic writing test with two tasks. Task 1 requires describing visual information (graph/chart/diagram). Task 2 requires writing an essay responding to a point of view, argument, or problem.',
    coin_cost=50,
    coin_refund=10,
    time_limit_minutes=60,
    passing_band_score=Decimal('5.0'),
    instructions='''INSTRUCTIONS TO CANDIDATES

• Answer BOTH tasks
• You have 60 minutes to complete this test
• Spend approximately 20 minutes on Task 1 and 40 minutes on Task 2
• Write your answers in pen (not pencil)
• Write clearly and legibly
• Do NOT write on the question paper

INFORMATION FOR CANDIDATES

• Task 1 requires a minimum of 150 words
• Task 2 requires a minimum of 250 words
• Answers below the minimum word count will receive a penalty
• Task 2 contributes twice as much to your final score as Task 1
• You will be assessed on: Task Achievement/Response, Coherence and Cohesion, Lexical Resource, and Grammatical Range and Accuracy''',
    is_active=True
)

# TASK 1: Academic - Line Graph
task1_prompt = """WRITING TASK 1

You should spend about 20 minutes on this task.

The graph below shows the number of overseas visitors to three different areas in a European country between 1987 and 2007.

Summarise the information by selecting and reporting the main features, and make comparisons where relevant.

Write at least 150 words.

[GRAPH DESCRIPTION:
Line graph showing visitor numbers (in thousands) from 1987-2007 for three areas:
- The coast: Started at 40,000 in 1987, slight decline to 35,000 in 1992, then steady increase to 75,000 by 2007
- The mountains: Started at 20,000 in 1987, remained relatively stable until 1997, then sharp increase to 35,000 by 2007
- The lakes: Started at 10,000 in 1987, fluctuated slightly, peaked at 75,000 in 2002, then declined to 50,000 by 2007]"""

IELTSQuestion.objects.create(
    exam=writing_exam,
    question_type='task1_academic',
    order=1,
    question_text=task1_prompt,
    correct_answer='',  # Writing tasks have no single correct answer
    points=Decimal('33.33'),  # Task 1 is 1/3 of total writing score
    passage_text='''Band descriptors for Task Achievement (Task 1):
Band 9: Fully satisfies all requirements, presents fully developed response
Band 7: Covers requirements, presents clear overview, highlights key features
Band 5: Addresses task only partially, presents but inadequately covers key features
Band 3: Fails to address task, presents limited ideas'''
)

# TASK 2: Essay - Opinion Essay
task2_prompt = """WRITING TASK 2

You should spend about 40 minutes on this task.

Write about the following topic:

In many countries today, people prefer to throw away broken items rather than repair them.

Why do you think this happens?
What problems might this throwaway culture create?

Give reasons for your answer and include any relevant examples from your own knowledge or experience.

Write at least 250 words."""

IELTSQuestion.objects.create(
    exam=writing_exam,
    question_type='task2_essay',
    order=2,
    question_text=task2_prompt,
    correct_answer='',  # Writing tasks have no single correct answer
    points=Decimal('66.67'),  # Task 2 is 2/3 of total writing score
    passage_text='''Band descriptors for Task Response (Task 2):
Band 9: Fully addresses all parts of task, presents fully developed position with relevant, extended and well-supported ideas
Band 7: Addresses all parts of task, presents clear position, main ideas extended and supported
Band 5: Addresses task only partially, expresses position but development not always clear
Band 3: Does not adequately address any part of task, presents limited position'''
)

print(f"  ✓ Created Writing section: Task 1 (Graph Description) + Task 2 (Essay)")

# ============================================================================
# SECTION 4: SPEAKING (11-14 minutes, 3 parts)
# ============================================================================

print("\n[4/4] Creating IELTS Speaking Section...")

# Delete existing speaking exam if it exists
IELTSExam.objects.filter(section='speaking').delete()

speaking_exam = IELTSExam.objects.create(
    section='speaking',
    title='IELTS Speaking Practice Test 1',
    description='Complete speaking test with three parts: Introduction and Interview (4-5 min), Individual Long Turn/Cue Card (3-4 min), and Two-way Discussion (4-5 min). Tests fluency, vocabulary, grammar, and pronunciation.',
    coin_cost=50,
    coin_refund=10,
    time_limit_minutes=14,
    passing_band_score=Decimal('5.0'),
    instructions='''INSTRUCTIONS TO CANDIDATES

• The speaking test has 3 parts
• Part 1: Introduction and Interview (4-5 minutes)
• Part 2: Individual Long Turn (3-4 minutes, including 1 minute preparation)
• Part 3: Two-way Discussion (4-5 minutes)
• Speak clearly into the microphone
• You will be assessed on: Fluency and Coherence, Lexical Resource, Grammatical Range and Accuracy, and Pronunciation

INFORMATION FOR CANDIDATES

• This is a simulated speaking test
• Record your responses for AI evaluation
• Speak naturally and at a comfortable pace
• Elaborate on your answers - avoid one-word responses
• In Part 2, you have 1 minute to prepare and should speak for 1-2 minutes''',
    is_active=True
)

# PART 1: Introduction and Interview (Questions 1-12)
part1_topics = [
    # Topic 1: Home/Accommodation (4 questions)
    {
        'order': 1,
        'text': 'Do you live in a house or an apartment?',
        'prompts': ['Describe your current accommodation', 'Mention what type it is', 'Say who you live with if relevant']
    },
    {
        'order': 2,
        'text': 'What do you like most about where you live?',
        'prompts': ['Describe specific features you enjoy', 'Explain why these features appeal to you']
    },
    {
        'order': 3,
        'text': 'Is there anything you would like to change about your home?',
        'prompts': ['Mention any improvements you would make', 'Explain your reasons']
    },
    {
        'order': 4,
        'text': 'Do you think you will continue living there for a long time?',
        'prompts': ['Give your future plans', 'Explain your reasoning']
    },
    # Topic 2: Work/Study (4 questions)
    {
        'order': 5,
        'text': 'What do you do? Do you work or are you a student?',
        'prompts': ['State whether you work or study', 'Mention your job or course']
    },
    {
        'order': 6,
        'text': 'What do you enjoy most about your work/studies?',
        'prompts': ['Describe specific aspects you find enjoyable', 'Explain why']
    },
    {
        'order': 7,
        'text': 'What are your responsibilities in your work/studies?',
        'prompts': ['Describe your main duties or subjects', 'Give examples']
    },
    {
        'order': 8,
        'text': 'What are your future career plans?',
        'prompts': ['Describe your goals', 'Explain what steps you plan to take']
    },
    # Topic 3: Hobbies/Interests (4 questions)
    {
        'order': 9,
        'text': 'What do you like to do in your free time?',
        'prompts': ['Mention your hobbies or interests', 'Say how often you do these activities']
    },
    {
        'order': 10,
        'text': 'Do you prefer indoor or outdoor activities?',
        'prompts': ['State your preference', 'Give reasons why']
    },
    {
        'order': 11,
        'text': 'Have your interests changed since you were a child?',
        'prompts': ['Compare your past and present interests', 'Explain any changes']
    },
    {
        'order': 12,
        'text': 'Is there a new hobby you would like to try?',
        'prompts': ['Mention something you would like to try', 'Explain why it interests you']
    }
]

for q in part1_topics:
    IELTSQuestion.objects.create(
        exam=speaking_exam,
        question_type='introduction',
        order=q['order'],
        question_text=q['text'],
        speaking_prompts=q['prompts'],
        correct_answer='',  # Speaking has no single correct answer
        points=Decimal('8.33'),  # 100 points / 12 Part 1 questions
        time_limit_seconds=0  # No strict time limit for Part 1 individual questions
    )

print(f"  ✓ Created Part 1: 12 questions (Introduction & Interview)")

# PART 2: Individual Long Turn (Cue Card)
cue_card = {
    'order': 13,
    'text': '''Describe a person who has had an important influence on your life.

You should say:
• Who this person is
• How you know this person
• What qualities this person has
• And explain why this person has been important in your life

You will have 1 minute to prepare your answer.
You should speak for 1-2 minutes.''',
    'prompts': [
        'Who this person is',
        'How you know this person',
        'What qualities this person has',
        'Why this person has been important in your life'
    ]
}

IELTSQuestion.objects.create(
    exam=speaking_exam,
    question_type='long_turn',
    order=cue_card['order'],
    question_text=cue_card['text'],
    speaking_prompts=cue_card['prompts'],
    correct_answer='',
    points=Decimal('25.0'),  # Part 2 is 25% of speaking score
    time_limit_seconds=60  # 60 seconds preparation time
)

print(f"  ✓ Created Part 2: 1 question (Individual Long Turn - Cue Card)")

# PART 3: Two-way Discussion (Questions 14-20)
part3_questions = [
    # Topic: Influential People in Society
    {
        'order': 14,
        'text': 'What kinds of people become role models in your country?',
        'prompts': ['Discuss different types of role models', 'Give examples', 'Explain their influence']
    },
    {
        'order': 15,
        'text': 'Do you think the media has too much influence on the role models young people choose?',
        'prompts': ['Give your opinion', 'Provide reasons', 'Consider both positive and negative aspects']
    },
    {
        'order': 16,
        'text': 'How important is it for young people to have good role models?',
        'prompts': ['Discuss the importance', 'Explain the impact on development', 'Give examples']
    },
    {
        'order': 17,
        'text': 'Do you think parents or teachers have more influence on children these days?',
        'prompts': ['Compare the influence of both', 'Give reasons for your view', 'Consider changes over time']
    },
    # Topic: Changing Relationships
    {
        'order': 18,
        'text': 'How have family relationships changed in recent years?',
        'prompts': ['Describe changes', 'Explain causes', 'Discuss whether changes are positive or negative']
    },
    {
        'order': 19,
        'text': 'What impact has technology had on relationships between people?',
        'prompts': ['Discuss both positive and negative impacts', 'Give specific examples', 'Consider different types of relationships']
    },
    {
        'order': 20,
        'text': 'Do you think people will maintain the same kinds of relationships in the future?',
        'prompts': ['Predict future trends', 'Give reasons', 'Consider technological and social changes']
    }
]

for q in part3_questions:
    IELTSQuestion.objects.create(
        exam=speaking_exam,
        question_type='discussion',
        order=q['order'],
        question_text=q['text'],
        speaking_prompts=q['prompts'],
        correct_answer='',
        points=Decimal('9.52'),  # Remaining points / 7 Part 3 questions
        time_limit_seconds=0  # No strict time limit
    )

print(f"  ✓ Created Part 3: 7 questions (Two-way Discussion)")

print("\n" + "=" * 80)
print("✅ IELTS EXAM CREATION COMPLETE!")
print("=" * 80)
print("\nSummary:")
print(f"  📖 Reading:   40 questions across 3 passages (60 min)")
print(f"  🎧 Listening: 40 questions across 4 parts (30 min)")
print(f"  ✍️  Writing:   2 tasks - Task 1 + Task 2 (60 min)")
print(f"  🗣️  Speaking:  20 questions across 3 parts (11-14 min)")
print(f"\n  Total: 102 questions/tasks")
print(f"  Cost: 50 coins per section")
print(f"  Refund: 10 coins for band score ≥ 5.0")
print("\nAll sections are now active and ready for students to take!")
print("=" * 80)
