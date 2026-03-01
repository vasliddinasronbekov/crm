import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { Picker } from '@react-native-picker/picker';
import api from '../services/api';
import { colors } from '../theme';

interface QuestionOption {
  option_text: string;
  is_correct: boolean;
  order: number;
}

interface Question {
  question_type: string;
  question_text: string;
  explanation: string;
  points: number;
  order: number;
  is_required: boolean;
  options: QuestionOption[];
}

export default function CreateQuizScreen({ navigation }: any) {
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState<any[]>([]);

  // Quiz metadata
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [course, setCourse] = useState('');
  const [quizType, setQuizType] = useState('practice');
  const [timeLimit, setTimeLimit] = useState('15');
  const [passingScore, setPassingScore] = useState('70');
  const [maxAttempts, setMaxAttempts] = useState('0');
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(true);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleAnswers, setShuffleAnswers] = useState(false);
  const [isPublished, setIsPublished] = useState(false);

  // Questions
  const [questions, setQuestions] = useState<Question[]>([
    {
      question_type: 'multiple_choice',
      question_text: '',
      explanation: '',
      points: 1,
      order: 1,
      is_required: true,
      options: [
        { option_text: '', is_correct: false, order: 1 },
        { option_text: '', is_correct: false, order: 2 },
      ],
    },
  ]);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const response = await api.get('/api/student-profile/courses/');
      setCourses(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching courses:', error);
    }
  };

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        question_type: 'multiple_choice',
        question_text: '',
        explanation: '',
        points: 1,
        order: questions.length + 1,
        is_required: true,
        options: [
          { option_text: '', is_correct: false, order: 1 },
          { option_text: '', is_correct: false, order: 2 },
        ],
      },
    ]);
  };

  const deleteQuestion = (index: number) => {
    if (questions.length === 1) {
      Alert.alert('Error', 'You must have at least one question');
      return;
    }
    const updated = questions.filter((_, i) => i !== index);
    updated.forEach((q, i) => (q.order = i + 1));
    setQuestions(updated);
  };

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    setQuestions(updated);
  };

  const addOption = (questionIndex: number) => {
    const updated = [...questions];
    updated[questionIndex].options.push({
      option_text: '',
      is_correct: false,
      order: updated[questionIndex].options.length + 1,
    });
    setQuestions(updated);
  };

  const deleteOption = (questionIndex: number, optionIndex: number) => {
    const updated = [...questions];
    if (updated[questionIndex].options.length <= 2) {
      Alert.alert('Error', 'You must have at least 2 options');
      return;
    }
    updated[questionIndex].options = updated[questionIndex].options.filter(
      (_, i) => i !== optionIndex
    );
    updated[questionIndex].options.forEach((opt, i) => (opt.order = i + 1));
    setQuestions(updated);
  };

  const updateOption = (
    questionIndex: number,
    optionIndex: number,
    field: keyof QuestionOption,
    value: any
  ) => {
    const updated = [...questions];
    const options = updated[questionIndex].options;

    if (field === 'is_correct' && value === true) {
      // Only one correct answer for multiple choice
      options.forEach((opt, i) => {
        opt.is_correct = i === optionIndex;
      });
    } else {
      options[optionIndex] = { ...options[optionIndex], [field]: value };
    }

    setQuestions(updated);
  };

  const handleSubmit = async () => {
    // Validation
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Please enter a quiz title');
      return;
    }

    if (!course) {
      Alert.alert('Validation Error', 'Please select a course');
      return;
    }

    // Validate questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question_text.trim()) {
        Alert.alert('Validation Error', `Question ${i + 1}: Please enter question text`);
        return;
      }

      if (q.question_type === 'multiple_choice' || q.question_type === 'true_false') {
        if (q.options.length < 2) {
          Alert.alert('Validation Error', `Question ${i + 1}: Please add at least 2 options`);
          return;
        }

        if (!q.options.some((opt) => opt.is_correct)) {
          Alert.alert('Validation Error', `Question ${i + 1}: Please mark a correct answer`);
          return;
        }

        for (let j = 0; j < q.options.length; j++) {
          if (!q.options[j].option_text.trim()) {
            Alert.alert(
              'Validation Error',
              `Question ${i + 1}, Option ${j + 1}: Please enter option text`
            );
            return;
          }
        }
      }
    }

    setLoading(true);

    try {
      const payload = {
        course: parseInt(course),
        title,
        description,
        quiz_type: quizType,
        time_limit_minutes: parseInt(timeLimit) || 0,
        passing_score: parseInt(passingScore) || 70,
        max_attempts: parseInt(maxAttempts) || 0,
        show_correct_answers: showCorrectAnswers,
        shuffle_questions: shuffleQuestions,
        shuffle_answers: shuffleAnswers,
        is_published: isPublished,
        questions: questions.map((q) => ({
          ...q,
          options:
            q.question_type === 'multiple_choice' || q.question_type === 'true_false'
              ? q.options
              : [],
        })),
      };

      await api.post('/api/v1/lms/quizzes/create_with_questions/', payload);
      Alert.alert('Success', 'Quiz created successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      console.error('Error creating quiz:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to create quiz');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Quiz</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Quiz Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quiz Information</Text>

          <Text style={styles.label}>Title *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g., English Grammar - Beginner Level"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Brief description of this quiz..."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
          />

          <Text style={styles.label}>Course *</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={course}
              onValueChange={(value) => setCourse(value)}
              style={styles.picker}
            >
              <Picker.Item label="Select a course" value="" />
              {courses.map((c) => (
                <Picker.Item key={c.id} label={c.name} value={c.id.toString()} />
              ))}
            </Picker>
          </View>

          <Text style={styles.label}>Quiz Type</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={quizType}
              onValueChange={(value) => setQuizType(value)}
              style={styles.picker}
            >
              <Picker.Item label="Practice Quiz" value="practice" />
              <Picker.Item label="Graded Quiz" value="graded" />
              <Picker.Item label="Exam" value="exam" />
            </Picker>
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.label}>Time Limit (min)</Text>
              <TextInput
                style={styles.input}
                value={timeLimit}
                onChangeText={setTimeLimit}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.label}>Passing Score (%)</Text>
              <TextInput
                style={styles.input}
                value={passingScore}
                onChangeText={setPassingScore}
                keyboardType="numeric"
              />
            </View>
          </View>

          <Text style={styles.label}>Max Attempts (0 = unlimited)</Text>
          <TextInput
            style={styles.input}
            value={maxAttempts}
            onChangeText={setMaxAttempts}
            keyboardType="numeric"
          />

          {/* Settings */}
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Show Correct Answers</Text>
            <Switch value={showCorrectAnswers} onValueChange={setShowCorrectAnswers} />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Shuffle Questions</Text>
            <Switch value={shuffleQuestions} onValueChange={setShuffleQuestions} />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Shuffle Answer Options</Text>
            <Switch value={shuffleAnswers} onValueChange={setShuffleAnswers} />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Publish Quiz</Text>
            <Switch value={isPublished} onValueChange={setIsPublished} />
          </View>
        </View>

        {/* Questions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Questions</Text>
            <TouchableOpacity style={styles.addButton} onPress={addQuestion}>
              <Icon name="add-circle" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {questions.map((question, qIndex) => (
            <View key={qIndex} style={styles.questionCard}>
              <View style={styles.questionHeader}>
                <Text style={styles.questionNumber}>Question {qIndex + 1}</Text>
                {questions.length > 1 && (
                  <TouchableOpacity onPress={() => deleteQuestion(qIndex)}>
                    <Icon name="trash-outline" size={20} color={colors.error} />
                  </TouchableOpacity>
                )}
              </View>

              <Text style={styles.label}>Question Text *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={question.question_text}
                onChangeText={(value) => updateQuestion(qIndex, 'question_text', value)}
                placeholder="Enter your question..."
                placeholderTextColor={colors.textMuted}
                multiline
              />

              <Text style={styles.label}>Question Type</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={question.question_type}
                  onValueChange={(value) => updateQuestion(qIndex, 'question_type', value)}
                  style={styles.picker}
                >
                  <Picker.Item label="Multiple Choice" value="multiple_choice" />
                  <Picker.Item label="True/False" value="true_false" />
                  <Picker.Item label="Short Answer" value="short_answer" />
                </Picker>
              </View>

              <Text style={styles.label}>Points</Text>
              <TextInput
                style={styles.input}
                value={question.points.toString()}
                onChangeText={(value) => updateQuestion(qIndex, 'points', parseInt(value) || 1)}
                keyboardType="numeric"
              />

              {/* Options */}
              {(question.question_type === 'multiple_choice' ||
                question.question_type === 'true_false') && (
                <View style={styles.optionsContainer}>
                  <View style={styles.optionsHeader}>
                    <Text style={styles.label}>Answer Options</Text>
                    {question.question_type === 'multiple_choice' && (
                      <TouchableOpacity onPress={() => addOption(qIndex)}>
                        <Icon name="add-circle-outline" size={20} color={colors.primary} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {question.options.map((option, oIndex) => (
                    <View key={oIndex} style={styles.optionRow}>
                      <TouchableOpacity
                        style={styles.radioButton}
                        onPress={() => updateOption(qIndex, oIndex, 'is_correct', true)}
                      >
                        <Icon
                          name={option.is_correct ? 'radio-button-on' : 'radio-button-off'}
                          size={24}
                          color={option.is_correct ? colors.primary : colors.textMuted}
                        />
                      </TouchableOpacity>
                      <TextInput
                        style={styles.optionInput}
                        value={option.option_text}
                        onChangeText={(value) =>
                          updateOption(qIndex, oIndex, 'option_text', value)
                        }
                        placeholder={`Option ${oIndex + 1}`}
                        placeholderTextColor={colors.textMuted}
                      />
                      {question.options.length > 2 && (
                        <TouchableOpacity onPress={() => deleteOption(qIndex, oIndex)}>
                          <Icon name="close-circle" size={20} color={colors.error} />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
              )}

              <Text style={styles.label}>Explanation (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={question.explanation}
                onChangeText={(value) => updateQuestion(qIndex, 'explanation', value)}
                placeholder="Explain the correct answer..."
                placeholderTextColor={colors.textMuted}
                multiline
              />
            </View>
          ))}
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.textOnPrimary} />
          ) : (
            <>
              <Icon name="checkmark-circle" size={20} color={colors.textOnPrimary} />
              <Text style={styles.submitButtonText}>Create Quiz</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  section: {
    backgroundColor: colors.surface,
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  addButton: {
    padding: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
    marginTop: 12,
    marginBottom: 4,
  },
  input: {
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.textPrimary,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  row: {
    flexDirection: 'row',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  switchLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  questionCard: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  questionNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  optionsContainer: {
    marginTop: 12,
  },
  optionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  radioButton: {
    padding: 4,
  },
  optionInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: colors.textPrimary,
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    margin: 16,
    padding: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 32,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
