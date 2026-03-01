import { createApiClient, AuthApiClient } from '@/packages/api-client';
import { API_URL, ENDPOINTS } from '../config/api';
import storage from './storage'; // Mobile-specific storage

// Token storage keys
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

// Mobile-specific token storage using SecureStore
const staffAppTokenStorage = {
  getAccessToken: () => storage.getItem(ACCESS_TOKEN_KEY),
  setAccessToken: (token: string) => storage.setItem(ACCESS_TOKEN_KEY, token),
  getRefreshToken: () => storage.getItem(REFRESH_TOKEN_KEY),
  setRefreshToken: (token: string) => storage.setItem(REFRESH_TOKEN_KEY, token),
  clearTokens: () => {
    storage.removeItem(ACCESS_TOKEN_KEY);
    storage.removeItem(REFRESH_TOKEN_KEY);
  },
};

// Create the core API client instance
const api = createApiClient({
  baseURL: API_URL,
  timeout: 30000,
  tokenStorage: staffAppTokenStorage,
  onTokenRefreshFailure: () => {
    // In a mobile app, you might dispatch an action to navigate to login
    console.warn('Token refresh failed, user needs to re-authenticate.');
    // Example: EventBus.emit('AUTH_FAILED');
  },
});

// Extend the AuthApiClient with staff-app specific methods
class StaffApiService extends AuthApiClient {
  constructor() {
    super(api, staffAppTokenStorage); // Pass the shared api instance and token storage
  }

  // Profile
  async getProfile() {
    return this.api.get(ENDPOINTS.PROFILE);
  }

  // Groups
  async getMyGroups() {
    return this.api.get(ENDPOINTS.GROUPS);
  }

  async getGroupDetail(groupId: number) {
    return this.api.get(`${ENDPOINTS.GROUPS}${groupId}/`);
  }

  async createGroup(data: any) {
    return this.api.post(ENDPOINTS.GROUPS, data);
  }

  async updateGroup(groupId: number, data: any) {
    return this.api.patch(`${ENDPOINTS.GROUPS}${groupId}/`, data);
  }

  async deleteGroup(groupId: number) {
    return this.api.delete(`${ENDPOINTS.GROUPS}${groupId}/`);
  }

  // Students
  async getStudents(params?: any) {
    return this.api.get(ENDPOINTS.STUDENTS, { params });
  }

  async getStudentDetail(studentId: number) {
    return this.api.get(`${ENDPOINTS.STUDENTS}${studentId}/`);
  }

  async createStudent(data: any) {
    return this.api.post(ENDPOINTS.STUDENTS, data);
  }

  async updateStudent(studentId: number, data: any) {
    return this.api.patch(`${ENDPOINTS.STUDENTS}${studentId}/`, data);
  }

  async deleteStudent(studentId: number) {
    return this.api.delete(`${ENDPOINTS.STUDENTS}${studentId}/`);
  }

  // Attendance
  async getAttendance(params?: any) {
    return this.api.get(ENDPOINTS.ATTENDANCE, { params });
  }

  async markAttendance(data: any) {
    return this.api.post(ENDPOINTS.ATTENDANCE, data);
  }

  async bulkMarkAttendance(attendanceList: any[]) {
    return this.api.post(ENDPOINTS.ATTENDANCE + 'bulk/', { attendance: attendanceList });
  }

  // Exam Scores
  async getExamScores(params?: any) {
    return this.api.get(ENDPOINTS.EXAM_SCORES, { params });
  }

  async createExamScore(data: any) {
    return this.api.post(ENDPOINTS.EXAM_SCORES, data);
  }

  async updateExamScore(scoreId: number, data: any) {
    return this.api.patch(`${ENDPOINTS.EXAM_SCORES}${scoreId}/`, data);
  }

  async deleteExamScore(scoreId: number) {
    return this.api.delete(`${ENDPOINTS.EXAM_SCORES}${scoreId}/`);
  }

  // Tasks
  async getBoards() {
    return this.api.get(ENDPOINTS.BOARDS);
  }

  async getTasks(params?: any) {
    return this.api.get(ENDPOINTS.TASKS, { params });
  }

  async createTask(data: any) {
    return this.api.post(ENDPOINTS.TASKS, data);
  }

  async updateTask(taskId: number, data: any) {
    return this.api.patch(`${ENDPOINTS.TASKS}${taskId}/`, data);
  }

  async deleteTask(taskId: number) {
    return this.api.delete(`${ENDPOINTS.TASKS}${taskId}/`);
  }

  async bulkCreateTasks(tasks: any[]) {
    return this.api.post(ENDPOINTS.TASKS_BULK_CREATE, { tasks });
  }

  // Salary
  async getMySalaries() {
    return this.api.get(ENDPOINTS.SALARY);
  }

  async getTeacherSalaries() {
    return this.api.get(ENDPOINTS.TEACHER_SALARY);
  }

  // Courses
  async getCourses() {
    return this.api.get(ENDPOINTS.COURSES);
  }

  async getBranches() {
    return this.api.get(ENDPOINTS.BRANCHES);
  }

  async getRooms(params?: any) {
    return this.api.get(ENDPOINTS.ROOMS, { params });
  }

  // LMS Content Management
  async getModules(courseId?: number) {
    const params = courseId ? { course: courseId } : undefined;
    return this.api.get(ENDPOINTS.MODULES, { params });
  }

  async createModule(data: any) {
    return this.api.post(ENDPOINTS.MODULES, data);
  }

  async getLessons(moduleId?: number) {
    const params = moduleId ? { module: moduleId } : undefined;
    return this.api.get(ENDPOINTS.LESSONS, { params });
  }

  async createLesson(data: any) {
    return this.api.post(ENDPOINTS.LESSONS, data);
  }

  // Assignments
  async getAssignments(params?: any) {
    return this.api.get(ENDPOINTS.ASSIGNMENTS, { params });
  }

  async createAssignment(data: any) {
    return this.api.post(ENDPOINTS.ASSIGNMENTS, data);
  }

  async getSubmissions(assignmentId?: number) {
    const params = assignmentId ? { assignment: assignmentId } : undefined;
    return this.api.get(ENDPOINTS.ASSIGNMENT_SUBMISSIONS, { params });
  }

  async gradeSubmission(submissionId: number, points: number, feedback: string) {
    return this.api.patch(`${ENDPOINTS.ASSIGNMENT_SUBMISSIONS}${submissionId}/`, {
      points_earned: points,
      feedback,
      status: 'graded',
    });
  }

  // Quizzes
  async getQuizzes(params?: any) {
    return this.api.get(ENDPOINTS.QUIZZES, { params });
  }

  async createQuiz(data: any) {
    return this.api.post(ENDPOINTS.QUIZZES, data);
  }

  async createQuestion(data: any) {
    return this.api.post(ENDPOINTS.QUESTIONS, data);
  }

  // Information
  async getInformation() {
    return this.api.get(ENDPOINTS.INFORMATION);
  }

  async createInformation(data: any) {
    return this.api.post(ENDPOINTS.INFORMATION, data);
  }

  // Analytics (for admins/teachers with access)
  async getAnalytics(params?: any) {
    return this.api.get(ENDPOINTS.ANALYTICS, { params });
  }

  // CRM
  async getLeads(params?: any) {
    return this.api.get(ENDPOINTS.LEADS, { params });
  }

  async updateLead(leadId: number, data: any) {
    return this.api.patch(`${ENDPOINTS.LEADS}${leadId}/`, data);
  }

  async createActivity(data: any) {
    return this.api.post(ENDPOINTS.ACTIVITIES, data);
  }

  // Voice AI Methods
  async speechToText(audioUri: string) {
    const formData = new FormData();
    formData.append('file', {
      uri: audioUri,
      type: 'audio/m4a',
      name: 'voice.m4a',
    } as any);

    return this.api.post('/api/v1/ai/stt/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  async textToSpeech(text: string, language: string = 'uz') {
    const response = await this.api.post(
      '/api/v1/ai/tts/',
      { text, language },
      { responseType: 'blob' }
    );
    return response.data;
  }

  async processIntent(text: string) {
    return this.api.post('/api/v1/ai/intent/', { text });
  }

  async processVoiceCommand(audioUri: string): Promise<{
    status: string;
    intent: string;
    confidence: number;
    message: string;
    data?: any;
  }> {
    // Step 1: Convert speech to text
    const sttResult = await this.speechToText(audioUri);
    const text = sttResult.corrected || sttResult.raw;

    // Step 2: Process intent
    const intentResult = await this.processIntent(text);

    return {
      status: intentResult.result?.status || 'ok',
      intent: intentResult.nlu?.intent || 'unknown',
      confidence: intentResult.nlu?.confidence || 0,
      message: intentResult.result?.message || text,
      data: intentResult.result?.data,
    };
  }
}

export default new StaffApiService();