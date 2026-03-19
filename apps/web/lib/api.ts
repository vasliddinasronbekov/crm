import axios, { AxiosInstance, AxiosError } from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.crmai.uz/api/";
const ACTIVE_BRANCH_STORAGE_KEY = "dashboard.active_branch_id";

interface BranchContextBranch {
  id: number;
  name: string;
}

interface BranchContextResponse {
  is_global_scope: boolean;
  active_branch_id: number | null;
  accessible_branch_ids: number[];
  branches: BranchContextBranch[];
}

interface LoginCredentials {
  username: string;
  password: string;
}

interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  photo?: string;
  is_teacher: boolean;
  is_staff: boolean;
  is_superuser: boolean;
}

class ApiService {
  private api: AxiosInstance;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private activeBranchId: number | null = null;

  constructor() {
    this.api = axios.create({
      baseURL: API_URL,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Request interceptor - add auth token
    this.api.interceptors.request.use(
      (config) => {
        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }
        if (this.activeBranchId !== null) {
          config.headers["X-Active-Branch"] = String(this.activeBranchId);
        }
        return config;
      },
      (error) => Promise.reject(error),
    );

    // Response interceptor - handle token refresh
    this.api.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as any;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const newAccessToken = await this.refreshAccessToken();
            if (newAccessToken && originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
              return this.api(originalRequest);
            }
          } catch (refreshError) {
            // Refresh failed, logout user
            this.logout();
            if (typeof window !== "undefined") {
              window.location.href = "/login";
            }
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      },
    );

    // Load tokens from localStorage on init (client-side only)
    if (typeof window !== "undefined") {
      this.accessToken = localStorage.getItem("access_token");
      this.refreshToken = localStorage.getItem("refresh_token");
      const storedBranchId = localStorage.getItem(ACTIVE_BRANCH_STORAGE_KEY);
      const parsedBranchId = storedBranchId ? Number.parseInt(storedBranchId, 10) : NaN;
      this.activeBranchId = Number.isFinite(parsedBranchId) ? parsedBranchId : null;
    }
  }

  // Generic methods
  async get<T = any>(url: string, config?: any): Promise<T> {
    const response = await this.api.get<T>(url, config);
    return response.data;
  }

  async post<T = any>(url: string, data?: any, config?: any): Promise<T> {
    const response = await this.api.post<T>(url, data, config);
    return response.data;
  }

  async put<T = any>(url: string, data?: any, config?: any): Promise<T> {
    const response = await this.api.put<T>(url, data, config);
    return response.data;
  }

  async patch<T = any>(url: string, data?: any, config?: any): Promise<T> {
    const response = await this.api.patch<T>(url, data, config);
    return response.data;
  }

  async delete<T = any>(url: string, config?: any): Promise<T> {
    const response = await this.api.delete<T>(url, config);
    return response.data;
  }

  // Authentication
  async login(credentials: LoginCredentials) {
    const response = await this.api.post("/auth/login/", credentials);
    const { access, refresh } = response.data;

    this.accessToken = access;
    this.refreshToken = refresh;

    if (typeof window !== "undefined") {
      localStorage.setItem("access_token", access);
      localStorage.setItem("refresh_token", refresh);
    }

    return response.data;
  }

  async logout() {
    try {
      if (this.refreshToken) {
        await this.api.post("/auth/logout/", { refresh: this.refreshToken });
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      this.accessToken = null;
      this.refreshToken = null;

      if (typeof window !== "undefined") {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
      }
    }
  }

  getActiveBranchId(): number | null {
    return this.activeBranchId;
  }

  setActiveBranchId(branchId: number | null) {
    this.activeBranchId = branchId;
    if (typeof window === "undefined") {
      return;
    }

    if (branchId === null) {
      localStorage.removeItem(ACTIVE_BRANCH_STORAGE_KEY);
      return;
    }
    localStorage.setItem(ACTIVE_BRANCH_STORAGE_KEY, String(branchId));
  }

  async getBranchContext(activeBranchId?: number | null): Promise<BranchContextResponse> {
    const params =
      activeBranchId === undefined
        ? undefined
        : activeBranchId === null
          ? { active_branch: "" }
          : { active_branch: activeBranchId };
    const response = await this.api.get<BranchContextResponse>("auth/branch-context/", {
      params,
    });
    return response.data;
  }

  async refreshAccessToken(): Promise<string | null> {
    if (!this.refreshToken) return null;

    try {
      const response = await axios.post(`${API_URL}auth/token/refresh/`, {
        refresh: this.refreshToken,
      });

      this.accessToken = response.data.access;

      if (typeof window !== "undefined") {
        localStorage.setItem("access_token", this.accessToken!);
      }

      return this.accessToken;
    } catch (error) {
      console.error("Token refresh failed:", error);
      return null;
    }
  }

  async getAccessToken(): Promise<string | null> {
    return this.accessToken;
  }

  async getProfile(): Promise<User> {
    const response = await this.api.get("/auth/profile/");
    return response.data;
  }

  async updateProfile(data: any) {
    const response = await this.api.patch("/auth/profile/", data);
    return response.data;
  }

  async changePassword(data: { old_password: string; new_password: string }) {
    const response = await this.api.post("/auth/change-password/", data);
    return response.data;
  }

  // Dashboard Stats
  async getDashboardStats() {
    const response = await this.api.get("/analytics/dashboard-stats/");
    return response.data;
  }

  async getCurrencyRates(params?: { force_refresh?: boolean }) {
    const response = await this.api.get("/v1/currency/rates/", { params });
    return response.data;
  }

  // Analytics
  async getAnalytics(params?: any) {
    const response = await this.api.get("/analytics/", { params });
    return response.data;
  }

  async getUserGrowth(period: string = "30d") {
    const response = await this.api.get("/analytics/user-growth/", {
      params: { period },
    });
    return response.data;
  }

  async getCourseCompletion(period: string = "30d") {
    const response = await this.api.get("/analytics/course-completion/", {
      params: { period },
    });
    return response.data;
  }

  // CRM
  async getCRMInsights(params?: { period_days?: number }) {
    const response = await this.api.get("/crm/insights/", { params });
    return response.data;
  }

  async getLeads(params?: {
    page?: number;
    limit?: number;
    [key: string]: any;
  }) {
    const response = await this.api.get("/crm/leads/", { params });
    return response.data;
  }

  async getLead(id: number) {
    const response = await this.api.get(`/crm/leads/${id}/`);
    return response.data;
  }

  async createLead(data: any) {
    const response = await this.api.post("/crm/leads/", data);
    return response.data;
  }

  async updateLead(id: number, data: any) {
    const response = await this.api.patch(`/crm/leads/${id}/`, data);
    return response.data;
  }

  async transitionLeadStage(
    id: number,
    data: { status: string; note?: string },
  ) {
    const response = await this.api.post(
      `/crm/leads/${id}/transition-stage/`,
      data,
    );
    return response.data;
  }

  async deleteLead(id: number) {
    const response = await this.api.delete(`/crm/leads/${id}/`);
    return response.data;
  }

  // CRM Deals
  async getDeals(params?: any) {
    const response = await this.api.get("/crm/deals/", { params });
    return response.data;
  }

  async getDeal(id: number) {
    const response = await this.api.get(`/crm/deals/${id}/`);
    return response.data;
  }

  async createDeal(data: any) {
    const response = await this.api.post("/crm/deals/", data);
    return response.data;
  }

  async updateDeal(id: number, data: any) {
    const response = await this.api.patch(`/crm/deals/${id}/`, data);
    return response.data;
  }

  async deleteDeal(id: number) {
    const response = await this.api.delete(`/crm/deals/${id}/`);
    return response.data;
  }

  // CRM Pipelines
  async getPipelines(params?: any) {
    const response = await this.api.get("/crm/pipelines/", { params });
    return response.data;
  }

  async getPipeline(id: number) {
    const response = await this.api.get(`/crm/pipelines/${id}/`);
    return response.data;
  }

  async createPipeline(data: any) {
    const response = await this.api.post("/crm/pipelines/", data);
    return response.data;
  }

  async updatePipeline(id: number, data: any) {
    const response = await this.api.patch(`/crm/pipelines/${id}/`, data);
    return response.data;
  }

  async deletePipeline(id: number) {
    const response = await this.api.delete(`/crm/pipelines/${id}/`);
    return response.data;
  }

  // CRM Pipeline Stages
  async getPipelineStages(params?: any) {
    const response = await this.api.get("/v1/crm/pipeline-stages/", { params });
    return response.data;
  }

  async createPipelineStage(data: any) {
    const response = await this.api.post("/v1/crm/pipeline-stages/", data);
    return response.data;
  }

  async updatePipelineStage(id: number, data: any) {
    const response = await this.api.patch(
      `/v1/crm/pipeline-stages/${id}/`,
      data,
    );
    return response.data;
  }

  async deletePipelineStage(id: number) {
    const response = await this.api.delete(`/v1/crm/pipeline-stages/${id}/`);
    return response.data;
  }

  // CRM Activities
  async getActivities(params?: any) {
    const response = await this.api.get("/crm/activities/", { params });
    return response.data;
  }

  async getActivity(id: number) {
    const response = await this.api.get(`/crm/activities/${id}/`);
    return response.data;
  }

  async createActivity(data: any) {
    const response = await this.api.post("/crm/activities/", data);
    return response.data;
  }

  async updateActivity(id: number, data: any) {
    const response = await this.api.patch(`/crm/activities/${id}/`, data);
    return response.data;
  }

  async deleteActivity(id: number) {
    const response = await this.api.delete(`/crm/activities/${id}/`);
    return response.data;
  }

  // CRM Sources
  async getSources() {
    const response = await this.api.get("/v1/source/");
    return response.data;
  }

  async createSource(data: any) {
    const response = await this.api.post("/v1/source/", data);
    return response.data;
  }

  async updateSource(id: number, data: any) {
    const response = await this.api.patch(`/v1/source/${id}/`, data);
    return response.data;
  }

  async deleteSource(id: number) {
    const response = await this.api.delete(`/v1/source/${id}/`);
    return response.data;
  }

  // CRM Departments
  async getDepartments() {
    const response = await this.api.get("/v1/lead-department/");
    return response.data;
  }

  async createDepartment(data: any) {
    const response = await this.api.post("/v1/lead-department/", data);
    return response.data;
  }

  async updateDepartment(id: number, data: any) {
    const response = await this.api.patch(`/v1/lead-department/${id}/`, data);
    return response.data;
  }

  async deleteDepartment(id: number) {
    const response = await this.api.delete(`/v1/lead-department/${id}/`);
    return response.data;
  }

  // Students
  async getStudents(params?: {
    page?: number;
    limit?: number;
    [key: string]: any;
  }) {
    const response = await this.api.get("/users/students/", { params });
    return response.data;
  }

  async getStudent(id: number) {
    const response = await this.api.get(`/users/students/${id}/`);
    return response.data;
  }

  async getStudentDetail(id: number) {
    const response = await this.api.get(`/users/students/${id}/detail_view/`);
    return response.data;
  }

  async createStudent(data: any) {
    const response = await this.api.post("/users/students/", data);
    return response.data;
  }

  async updateStudent(id: number, data: any) {
    const response = await this.api.patch(`/users/students/${id}/`, data);
    return response.data;
  }

  async deleteStudent(id: number) {
    const response = await this.api.delete(`/users/students/${id}/`);
    return response.data;
  }

  async reactivateStudent(id: number, data?: { group?: number | string }) {
    const response = await this.api.post(
      `/users/students/${id}/reactivate_account/`,
      data || {},
    );
    return response.data;
  }

  async activateStudentAccount(id: number, data?: { group?: number | string }) {
    const response = await this.api.post(
      `/users/students/${id}/activate_account/`,
      data || {},
    );
    return response.data;
  }

  async freezeStudentAccount(id: number) {
    const response = await this.api.post(
      `/users/students/${id}/freeze_account/`,
      {},
    );
    return response.data;
  }

  async deactivateStudentAccount(id: number) {
    const response = await this.api.post(
      `/users/students/${id}/deactivate_account/`,
      {},
    );
    return response.data;
  }

  // Teachers
  async getTeachers(params?: {
    page?: number;
    limit?: number;
    [key: string]: any;
  }) {
    const response = await this.api.get("/users/teachers/", { params });
    return response.data;
  }

  async getTeacher(id: number) {
    const response = await this.api.get(`/users/teachers/${id}/`);
    return response.data;
  }

  async createTeacher(data: any) {
    const response = await this.api.post("/users/teachers/", data);
    return response.data;
  }

  async updateTeacher(id: number, data: any) {
    const response = await this.api.patch(`/users/teachers/${id}/`, data);
    return response.data;
  }

  async deleteTeacher(id: number) {
    const response = await this.api.delete(`/users/teachers/${id}/`);
    return response.data;
  }

  // Groups
  async getGroups(params?: {
    page?: number;
    limit?: number;
    [key: string]: any;
  }) {
    const response = await this.api.get("/student-profile/groups/", { params });
    return response.data;
  }

  async getGroup(id: number) {
    const response = await this.api.get(`/student-profile/groups/${id}/`);
    return response.data;
  }

  async getGroupDetail(id: number) {
    const response = await this.api.get(`/student-profile/groups/${id}/`);
    return response.data;
  }

  async getGroupScheduleHealth(params?: { [key: string]: any }) {
    const response = await this.api.get("/student-profile/groups/schedule-health/", {
      params,
    });
    return response.data;
  }

  async getOngoingGroups(params?: { [key: string]: any }) {
    const response = await this.api.get("/student-profile/groups/ongoing/", {
      params,
    });
    return response.data;
  }

  async createGroup(data: any) {
    const response = await this.api.post("/student-profile/groups/", data);
    return response.data;
  }

  async updateGroup(id: number, data: any) {
    const response = await this.api.patch(
      `/student-profile/groups/${id}/`,
      data,
    );
    return response.data;
  }

  async deleteGroup(id: number) {
    const response = await this.api.delete(`/student-profile/groups/${id}/`);
    return response.data;
  }

  // Courses
  async getCourses(params?: {
    page?: number;
    limit?: number;
    [key: string]: any;
  }) {
    const response = await this.api.get("/student-profile/courses/", {
      params,
    });
    return response.data;
  }

  async getCourse(id: number) {
    const response = await this.api.get(`/student-profile/courses/${id}/`);
    return response.data;
  }

  async createCourse(data: any) {
    const response = await this.api.post("/student-profile/courses/", data);
    return response.data;
  }

  async updateCourse(id: number, data: any) {
    const response = await this.api.patch(
      `/student-profile/courses/${id}/`,
      data,
    );
    return response.data;
  }

  async deleteCourse(id: number) {
    const response = await this.api.delete(`/student-profile/courses/${id}/`);
    return response.data;
  }

  // LMS Modules
  async getModules(params?: any) {
    const response = await this.api.get("/v1/lms/modules/", { params });
    return response.data;
  }

  async getModule(id: number) {
    const response = await this.api.get(`/v1/lms/modules/${id}/`);
    return response.data;
  }

  async createModule(data: any) {
    const response = await this.api.post("/v1/lms/modules/", data);
    return response.data;
  }

  async updateModule(id: number, data: any) {
    const response = await this.api.patch(`/v1/lms/modules/${id}/`, data);
    return response.data;
  }

  async deleteModule(id: number) {
    const response = await this.api.delete(`/v1/lms/modules/${id}/`);
    return response.data;
  }

  // LMS Lessons
  async getLessons(params?: any) {
    const response = await this.api.get("/v1/lms/lessons/", { params });
    return response.data;
  }

  async getLesson(id: number) {
    const response = await this.api.get(`/v1/lms/lessons/${id}/`);
    return response.data;
  }

  async createLesson(data: any) {
    const response = await this.api.post("/v1/lms/lessons/", data);
    return response.data;
  }

  async updateLesson(id: number, data: any) {
    const response = await this.api.patch(`/v1/lms/lessons/${id}/`, data);
    return response.data;
  }

  async deleteLesson(id: number) {
    const response = await this.api.delete(`/v1/lms/lessons/${id}/`);
    return response.data;
  }

  // LMS Assignments
  async getAssignments(params?: any) {
    const response = await this.api.get("/v1/lms/assignments/", { params });
    return response.data;
  }

  async getAssignment(id: number) {
    const response = await this.api.get(`/v1/lms/assignments/${id}/`);
    return response.data;
  }

  async createAssignment(data: any) {
    const response = await this.api.post("/v1/lms/assignments/", data);
    return response.data;
  }

  async updateAssignment(id: number, data: any) {
    const response = await this.api.patch(`/v1/lms/assignments/${id}/`, data);
    return response.data;
  }

  async deleteAssignment(id: number) {
    const response = await this.api.delete(`/v1/lms/assignments/${id}/`);
    return response.data;
  }

  // LMS Assignment Submissions
  async getAssignmentSubmissions(params?: any) {
    const response = await this.api.get("/v1/lms/assignment-submissions/", {
      params,
    });
    return response.data;
  }

  async getAssignmentSubmission(id: number) {
    const response = await this.api.get(
      `/v1/lms/assignment-submissions/${id}/`,
    );
    return response.data;
  }

  async getAssignmentSubmissionReview(id: number) {
    const response = await this.api.get(
      `/v1/lms/assignment-submissions/${id}/review/`,
    );
    return response.data;
  }

  async getAssignmentSubmissionAuditTimeline(id: number) {
    const response = await this.api.get(
      `/v1/lms/assignment-submissions/${id}/audit_timeline/`,
    );
    return response.data;
  }

  async getAssignmentGradingQueue(params?: any) {
    const response = await this.api.get(
      "/v1/lms/assignment-submissions/grading_queue/",
      { params },
    );
    return response.data;
  }

  async bulkGradeSubmissions(data: {
    submission_ids: number[];
    grading_mode: "score" | "rubric";
    points_earned?: number;
    rubric_percent?: number;
    rubric_label?: string;
    feedback?: string;
    status?: "graded" | "returned";
  }) {
    const response = await this.api.post(
      "/v1/lms/assignment-submissions/bulk_grade/",
      data,
    );
    return response.data;
  }

  async gradeSubmission(id: number, data: any) {
    const response = await this.api.patch(
      `/v1/lms/assignment-submissions/${id}/`,
      data,
    );
    return response.data;
  }

  // LMS Announcements
  async getAnnouncements(params?: any) {
    const response = await this.api.get("/v1/lms/announcements/", { params });
    return response.data;
  }

  async createAnnouncement(data: any) {
    const response = await this.api.post("/v1/lms/announcements/", data);
    return response.data;
  }

  async updateAnnouncement(id: number, data: any) {
    const response = await this.api.patch(`/v1/lms/announcements/${id}/`, data);
    return response.data;
  }

  async deleteAnnouncement(id: number) {
    const response = await this.api.delete(`/v1/lms/announcements/${id}/`);
    return response.data;
  }

  // LMS Student Progress
  async getStudentProgress(params?: any) {
    const response = await this.api.get("/v1/lms/progress/", { params });
    return response.data;
  }

  async updateStudentProgress(data: any) {
    const response = await this.api.post("/v1/lms/progress/", data);
    return response.data;
  }

  // Attendance
  async getAttendance(params?: any) {
    const response = await this.api.get("/student-profile/attendance/", {
      params,
    });
    return response.data;
  }

  async markAttendance(data: any) {
    const response = await this.api.post("/student-profile/attendance/", data);
    return response.data;
  }

  async bulkMarkAttendance(attendanceList: any[]) {
    const response = await this.api.post(
      "/student-profile/attendance/bulk_create/",
      {
        attendance_list: attendanceList,
      },
    );
    return response.data;
  }

  async updateAttendance(id: number, data: any) {
    const response = await this.api.patch(
      `/student-profile/attendance/${id}/`,
      data,
    );
    return response.data;
  }

  async deleteAttendance(id: number) {
    const response = await this.api.delete(
      `/student-profile/attendance/${id}/`,
    );
    return response.data;
  }

  // Tasks
  async getTasks(params?: any) {
    const response = await this.api.get("/task/tasks/", { params });
    return response.data;
  }

  async getTask(id: number) {
    const response = await this.api.get(`/task/tasks/${id}/`);
    return response.data;
  }

  async createTask(data: any) {
    const response = await this.api.post("/task/tasks/", data);
    return response.data;
  }

  async updateTask(id: number, data: any) {
    const response = await this.api.patch(`/task/tasks/${id}/`, data);
    return response.data;
  }

  async deleteTask(id: number) {
    const response = await this.api.delete(`/task/tasks/${id}/`);
    return response.data;
  }

  // Exam Scores
  async getExamScores(params?: any) {
    const response = await this.api.get("/student-profile/exam-scores/", {
      params,
    });
    return response.data;
  }

  async getExamScore(id: number) {
    const response = await this.api.get(`/student-profile/exam-scores/${id}/`);
    return response.data;
  }

  async createExamScore(data: any) {
    const response = await this.api.post("/student-profile/exam-scores/", data);
    return response.data;
  }

  async updateExamScore(id: number, data: any) {
    const response = await this.api.patch(
      `/student-profile/exam-scores/${id}/`,
      data,
    );
    return response.data;
  }

  async deleteExamScore(id: number) {
    const response = await this.api.delete(
      `/student-profile/exam-scores/${id}/`,
    );
    return response.data;
  }

  // Events
  async getEvents(params?: any) {
    const response = await this.api.get("/v1/student-profile/events/", {
      params,
    });
    return response.data;
  }

  async getEvent(id: number) {
    const response = await this.api.get(`/v1/student-profile/events/${id}/`);
    return response.data;
  }

  async createEvent(data: any) {
    const response = await this.api.post("/v1/student-profile/events/", data);
    return response.data;
  }

  async updateEvent(id: number, data: any) {
    const response = await this.api.patch(
      `/v1/student-profile/events/${id}/`,
      data,
    );
    return response.data;
  }

  async deleteEvent(id: number) {
    const response = await this.api.delete(`/v1/student-profile/events/${id}/`);
    return response.data;
  }

  // Certificates
  async getCertificates(params?: any) {
    const response = await this.api.get("/task/certificates/", { params });
    return response.data;
  }

  async getCertificate(id: number) {
    const response = await this.api.get(`/task/certificates/${id}/`);
    return response.data;
  }

  async generateCertificate(data: any) {
    const response = await this.api.post("/task/certificates/", data);
    return response.data;
  }

  async downloadCertificate(id: number) {
    const response = await this.api.get(`/task/certificates/${id}/download/`, {
      responseType: "blob",
    });
    return response.data;
  }

  async regenerateCertificate(id: number) {
    const response = await this.api.post(
      `/task/certificates/${id}/regenerate/`,
    );
    return response.data;
  }

  async verifyCertificate(params: { id?: string; code?: string }) {
    const response = await this.api.get("/task/certificates/verify/", {
      params,
    });
    return response.data;
  }

  async getCertificateEligibility(params: {
    student_id: number;
    course_id: number;
  }) {
    const response = await this.api.get("/task/certificates/eligibility/", {
      params,
    });
    return response.data;
  }

  async updateCertificate(id: number, data: any) {
    const response = await this.api.patch(`/task/certificates/${id}/`, data);
    return response.data;
  }

  async deleteCertificate(id: number) {
    const response = await this.api.delete(`/task/certificates/${id}/`);
    return response.data;
  }

  // Certificate Templates
  async getCertificateTemplates(params?: any) {
    const response = await this.api.get("/task/certificate-templates/", {
      params,
    });
    return response.data;
  }

  async getCertificateTemplate(id: number) {
    const response = await this.api.get(`/task/certificate-templates/${id}/`);
    return response.data;
  }

  async createCertificateTemplate(data: any) {
    const response = await this.api.post("/task/certificate-templates/", data, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  }

  async updateCertificateTemplate(id: number, data: any) {
    const response = await this.api.patch(
      `/task/certificate-templates/${id}/`,
      data,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );
    return response.data;
  }

  async deleteCertificateTemplate(id: number) {
    const response = await this.api.delete(
      `/task/certificate-templates/${id}/`,
    );
    return response.data;
  }

  async setDefaultCertificateTemplate(id: number) {
    const response = await this.api.post(
      `/task/certificate-templates/${id}/set_default/`,
    );
    return response.data;
  }

  // Reports
  async getReports(params?: {
    page?: number;
    limit?: number;
    [key: string]: any;
  }) {
    const response = await this.api.get("/analytics/reports/", { params });
    return response.data;
  }

  async generateReport(reportType: string, params?: any) {
    const response = await this.api.post("/analytics/reports/generate/", {
      report_type: reportType,
      ...params,
    });
    return response.data;
  }

  async getReport(reportId: string) {
    const response = await this.api.get(`/analytics/reports/${reportId}/`);
    return response.data;
  }

  async downloadReport(reportId: string, format: "csv" | "json" = "csv") {
    const response = await this.api.get(`/analytics/reports/${reportId}/download/`, {
      params: { file_format: format },
      responseType: "blob",
    });
    return response.data;
  }

  async getScheduledReports(params?: {
    page?: number;
    limit?: number;
    enabled?: boolean;
    report_type?: string;
    frequency?: string;
    [key: string]: any;
  }) {
    const response = await this.api.get('/v1/student-profile/reports/scheduled-reports/', { params });
    return response.data;
  }

  async createScheduledReport(data: {
    report_type: string;
    frequency: 'daily' | 'weekly' | 'monthly';
    day_of_week?: string | null;
    time: string;
    recipients: string;
    enabled?: boolean;
    parameters?: Record<string, any>;
  }) {
    const response = await this.api.post('/v1/student-profile/reports/scheduled-reports/', data);
    return response.data;
  }

  async updateScheduledReport(id: number, data: Record<string, any>) {
    const response = await this.api.patch(`/v1/student-profile/reports/scheduled-reports/${id}/`, data);
    return response.data;
  }

  async deleteScheduledReport(id: number) {
    const response = await this.api.delete(`/v1/student-profile/reports/scheduled-reports/${id}/`);
    return response.data;
  }

  async toggleScheduledReport(id: number) {
    const response = await this.api.post(`/v1/student-profile/reports/scheduled-reports/${id}/toggle/`);
    return response.data;
  }

  async runScheduledReportNow(id: number) {
    const response = await this.api.post(`/v1/student-profile/reports/scheduled-reports/${id}/run_now/`);
    return response.data;
  }

  async getReportGenerations(params?: {
    page?: number;
    limit?: number;
    status?: string;
    report_type?: string;
    date_from?: string;
    date_to?: string;
    [key: string]: any;
  }) {
    const response = await this.api.get('/v1/student-profile/reports/report-generations/', { params });
    return response.data;
  }

  // Messaging
  async getMessages(params?: any) {
    const response = await this.api.get("/messaging/messages/", { params });
    return response.data;
  }

  async getConversations(params?: any) {
    const response = await this.api.get("/messaging/conversations/", {
      params,
    });
    return response.data;
  }

  async createConversation(data: {
    title?: string;
    conversation_type?: string;
    participants?: number[];
    participant_ids?: number[];
  }) {
    const response = await this.api.post("/messaging/conversations/", data);
    return response.data;
  }

  async getConversationMessages(conversationId: number, params?: any) {
    const response = await this.api.get(
      `/messaging/conversations/${conversationId}/messages/`,
      { params },
    );
    return response.data;
  }

  async sendConversationMessage(
    conversationId: number,
    data: {
      content: string;
      message_type?: "text" | "audio" | "image" | "file" | "system";
      metadata?: Record<string, any>;
    },
  ) {
    const response = await this.api.post(
      `/messaging/conversations/${conversationId}/send_message/`,
      data,
    );
    return response.data;
  }

  async markConversationRead(
    conversationId: number,
    messageIds?: Array<string | number>,
  ) {
    const response = await this.api.post(
      `/messaging/conversations/${conversationId}/mark_read/`,
      { message_ids: messageIds || [] },
    );
    return response.data;
  }

  async sendMessage(data: any) {
    const response = await this.api.post("/v1/send-message/", data);
    return response.data;
  }

  async sendSms(data: { recipient_user_ids: number[]; message_text: string }) {
    const response = await this.api.post("/v1/send-message/", {
      ...data,
      message_type: "sms",
    });
    return response.data;
  }

  async sendSmsInConversation(conversationId: number, message_text: string) {
    const response = await this.api.post(
      `/messaging/conversations/${conversationId}/send_sms/`,
      { message_text },
    );
    return response.data;
  }

  // Branches
  async getBranches(params?: any) {
    const response = await this.api.get("/crm/branches/", { params });
    return response.data;
  }

  async getBranch(id: number) {
    const response = await this.api.get(`/crm/branches/${id}/`);
    return response.data;
  }

  async createBranch(data: any) {
    const response = await this.api.post("/crm/branches/", data);
    return response.data;
  }

  async updateBranch(id: number, data: any) {
    const response = await this.api.patch(`/crm/branches/${id}/`, data);
    return response.data;
  }

  async deleteBranch(id: number) {
    const response = await this.api.delete(`/crm/branches/${id}/`);
    return response.data;
  }

  // Rooms
  async getRooms(params?: any) {
    const response = await this.api.get("/crm/rooms/", { params });
    return response.data;
  }

  async getRoom(id: number) {
    const response = await this.api.get(`/crm/rooms/${id}/`);
    return response.data;
  }

  async createRoom(data: any) {
    const response = await this.api.post("/crm/rooms/", data);
    return response.data;
  }

  async updateRoom(id: number, data: any) {
    const response = await this.api.patch(`/crm/rooms/${id}/`, data);
    return response.data;
  }

  async deleteRoom(id: number) {
    const response = await this.api.delete(`/crm/rooms/${id}/`);
    return response.data;
  }

  // Payments
  async getPayments(params?: {
    page?: number;
    limit?: number;
    [key: string]: any;
  }) {
    const response = await this.api.get("/v1/payment/", { params });
    return response.data;
  }

  async getPayment(id: number) {
    const response = await this.api.get(`/v1/payment/${id}/`);
    return response.data;
  }

  async createPayment(data: any) {
    const response = await this.api.post("/v1/payment/", data);
    return response.data;
  }

  async updatePayment(id: number, data: any) {
    const response = await this.api.patch(`/v1/payment/${id}/`, data);
    return response.data;
  }

  async deletePayment(id: number) {
    const response = await this.api.delete(`/v1/payment/${id}/`);
    return response.data;
  }

  async sendPaymentReminder(id: number) {
    const response = await this.api.post(`/v1/payment/${id}/send_reminder/`);
    return response.data;
  }

  async sendBulkPaymentReminders(paymentIds: number[]) {
    const response = await this.api.post("/v1/payment/bulk_send_reminders/", {
      payment_ids: paymentIds,
    });
    return response.data;
  }

  async getCashReceipt(paymentId: number) {
    const response = await this.api.get(`/v1/payment/${paymentId}/cash-receipt/`);
    return response.data;
  }

  async getPaymentReconciliationOverview(params?: {
    limit?: number;
    stale_pending_days?: number;
    methods?: string;
  }) {
    const response = await this.api.get('/v1/payment/reconciliation/overview/', { params });
    return response.data;
  }

  async syncPaymentReconciliation(payload: {
    payment_ids: number[];
    dry_run?: boolean;
  }) {
    const response = await this.api.post('/v1/payment/reconciliation/sync/', payload);
    return response.data;
  }

  async getPaymentAuditTrail(paymentId: number, params?: { limit?: number }) {
    const response = await this.api.get(`/v1/payment/${paymentId}/audit-trail/`, { params });
    return response.data;
  }

  async getCashReceiptByToken(token: string) {
    const response = await this.api.get(`/v1/payment/cash-receipt-by-token/${token}/`);
    return response.data;
  }

  async verifyCashReceiptToken(token: string) {
    const response = await this.api.get(`/v1/payment/receipt/verify/${token}/`);
    return response.data;
  }

  async saveAutoReminderSettings(settings: any) {
    const payload = {
      enabled: settings?.enabled,
      days_before_due: settings?.days_before_due ?? settings?.daysBeforeDue,
      frequency: settings?.frequency,
      email_template: settings?.email_template ?? settings?.emailTemplate,
    };
    const response = await this.api.post(
      "/v1/payment/reminder-settings/",
      payload,
    );
    return response.data;
  }

  async getPaymentTypes(params?: {
    page?: number;
    limit?: number;
    [key: string]: any;
  }) {
    const response = await this.api.get("/v1/payment-type/", { params });
    return response.data;
  }

  // Task Management - Boards
  async getBoards(params?: any) {
    const response = await this.api.get("/task/boards/", { params });
    return response.data;
  }

  async getBoard(id: number) {
    const response = await this.api.get(`/task/boards/${id}/`);
    return response.data;
  }

  async createBoard(data: any) {
    const response = await this.api.post("/task/boards/", data);
    return response.data;
  }

  async updateBoard(id: number, data: any) {
    const response = await this.api.patch(`/task/boards/${id}/`, data);
    return response.data;
  }

  async deleteBoard(id: number) {
    const response = await this.api.delete(`/task/boards/${id}/`);
    return response.data;
  }

  // Task Management - Lists
  async getLists(params?: any) {
    const response = await this.api.get("/task/lists/", { params });
    return response.data;
  }

  async getList(id: number) {
    const response = await this.api.get(`/task/lists/${id}/`);
    return response.data;
  }

  async createList(data: any) {
    const response = await this.api.post("/task/lists/", data);
    return response.data;
  }

  async updateList(id: number, data: any) {
    const response = await this.api.patch(`/task/lists/${id}/`, data);
    return response.data;
  }

  async deleteList(id: number) {
    const response = await this.api.delete(`/task/lists/${id}/`);
    return response.data;
  }

  // Task Management - Auto Tasks
  async getAutoTasks(params?: any) {
    const response = await this.api.get("/task/autotasks/", { params });
    return response.data;
  }

  async createAutoTask(data: any) {
    const response = await this.api.post("/task/autotasks/", data);
    return response.data;
  }

  async updateAutoTask(id: number, data: any) {
    const response = await this.api.patch(`/task/autotasks/${id}/`, data);
    return response.data;
  }

  async deleteAutoTask(id: number) {
    const response = await this.api.delete(`/task/autotasks/${id}/`);
    return response.data;
  }

  // HR - Teacher Salaries
  async getTeacherSalaries(params?: {
    page?: number;
    limit?: number;
    [key: string]: any;
  }) {
    const response = await this.api.get("/v1/teacher-salary/", { params });
    return response.data;
  }

  async getTeacherSalary(id: number) {
    const response = await this.api.get(`/v1/teacher-salary/${id}/`);
    return response.data;
  }

  async createTeacherSalary(data: any) {
    const response = await this.api.post("/v1/teacher-salary/", data);
    return response.data;
  }

  async updateTeacherSalary(id: number, data: any) {
    const response = await this.api.patch(`/v1/teacher-salary/${id}/`, data);
    return response.data;
  }

  async deleteTeacherSalary(id: number) {
    const response = await this.api.delete(`/v1/teacher-salary/${id}/`);
    return response.data;
  }

  // HR - Group Salaries
  async getGroupSalaries(params?: any) {
    const response = await this.api.get("/v1/mentor/salary/", { params });
    return response.data;
  }

  async createGroupSalary(data: any) {
    const response = await this.api.post("/v1/mentor/salary/", data);
    return response.data;
  }

  async updateGroupSalary(id: number, data: any) {
    const response = await this.api.patch(`/v1/mentor/salary/${id}/`, data);
    return response.data;
  }

  async deleteGroupSalary(id: number) {
    const response = await this.api.delete(`/v1/mentor/salary/${id}/`);
    return response.data;
  }

  // Quizzes
  async getQuizzes(params?: any) {
    const response = await this.api.get("/v1/lms/quizzes/", { params });
    return response.data;
  }

  async getQuizDashboardSummary(params?: any) {
    const response = await this.api.get("/v1/lms/quizzes/dashboard_summary/", { params });
    return response.data;
  }

  async getQuiz(id: number) {
    const response = await this.api.get(`/v1/lms/quizzes/${id}/`);
    return response.data;
  }

  async createQuizWithQuestions(data: any) {
    const response = await this.api.post(
      "/v1/lms/quizzes/create_with_questions/",
      data,
    );
    return response.data;
  }

  async updateQuiz(id: number, data: any) {
    const response = await this.api.patch(`/v1/lms/quizzes/${id}/`, data);
    return response.data;
  }

  async deleteQuiz(id: number) {
    const response = await this.api.delete(`/v1/lms/quizzes/${id}/`);
    return response.data;
  }

  async duplicateQuiz(id: number) {
    const response = await this.api.post(`/v1/lms/quizzes/${id}/duplicate/`);
    return response.data;
  }

  async getQuizQuestions(id: number) {
    const response = await this.api.get(`/v1/lms/quizzes/${id}/questions/`);
    return response.data;
  }

  async getQuizStatistics(id: number) {
    const response = await this.api.get(`/v1/lms/quizzes/${id}/statistics/`);
    return response.data;
  }

  async getQuizLeaderboard(id: number) {
    const response = await this.api.get(`/v1/lms/quizzes/${id}/leaderboard/`);
    return response.data;
  }

  async getQuizQuestionAnalytics(id: number) {
    const response = await this.api.get(`/v1/lms/quizzes/${id}/question_analytics/`);
    return response.data;
  }

  async getQuizAttempts(params?: any) {
    const response = await this.api.get('/v1/lms/quiz-attempts/', { params });
    return response.data;
  }

  async getQuizAnswers(params?: any) {
    const response = await this.api.get('/v1/lms/quiz-answers/', { params });
    return response.data;
  }

  async gradeQuizAnswer(id: number, data: any) {
    const response = await this.api.post(`/v1/lms/quiz-answers/${id}/grade_manually/`, data);
    return response.data;
  }

  // Questions
  async getQuestions(params?: any) {
    const response = await this.api.get("/v1/lms/questions/", { params });
    return response.data;
  }

  async createQuestion(data: any) {
    const response = await this.api.post("/v1/lms/questions/", data);
    return response.data;
  }

  async updateQuestion(id: number, data: any) {
    const response = await this.api.patch(`/v1/lms/questions/${id}/`, data);
    return response.data;
  }

  async deleteQuestion(id: number) {
    const response = await this.api.delete(`/v1/lms/questions/${id}/`);
    return response.data;
  }

  // Shop & Rewards
  async getShopProducts(params?: any) {
    const response = await this.api.get("/v1/student-profile/product/", {
      params,
    });
    return response.data;
  }

  async getShopProduct(id: number) {
    const response = await this.api.get(`/v1/student-profile/product/${id}/`);
    return response.data;
  }

  async createShopProduct(data: any) {
    const config =
      data instanceof FormData
        ? { headers: { "Content-Type": "multipart/form-data" } }
        : undefined;
    const response = await this.api.post("/v1/student-profile/product/", data, config);
    return response.data;
  }

  async updateShopProduct(id: number, data: any) {
    const config =
      data instanceof FormData
        ? { headers: { "Content-Type": "multipart/form-data" } }
        : undefined;
    const response = await this.api.patch(
      `/v1/student-profile/product/${id}/`,
      data,
      config,
    );
    return response.data;
  }

  async deleteShopProduct(id: number) {
    const response = await this.api.delete(
      `/v1/student-profile/product/${id}/`,
    );
    return response.data;
  }

  async getShopOrders(params?: any) {
    const response = await this.api.get("/v1/student-profile/order/", {
      params,
    });
    return response.data;
  }

  async getStudentCoins(params?: any) {
    const response = await this.api.get("/v1/student-bonus/", { params });
    return response.data;
  }

  async awardStudentCoins(data: {
    student_id: number;
    amount: number;
    reason: string;
  }) {
    // Map frontend data structure to backend expectations
    const payload = {
      student: data.student_id, // Backend expects 'student' not 'student_id'
      coin: data.amount, // Backend expects 'coin' not 'amount'
      reason: data.reason,
    };
    const response = await this.api.post("/v1/student-bonus/", payload);
    return response.data;
  }

  // Support Tickets
  async getTickets(params?: any) {
    const response = await this.api.get("/v1/student-profile/ticket/tickets/", {
      params,
    });
    return response.data;
  }

  async getTicket(id: number) {
    const response = await this.api.get(
      `/v1/student-profile/ticket/tickets/${id}/`,
    );
    return response.data;
  }

  async updateTicket(id: number, data: any) {
    const response = await this.api.patch(
      `/v1/student-profile/ticket/tickets/${id}/`,
      data,
    );
    return response.data;
  }

  async deleteTicket(id: number) {
    const response = await this.api.delete(
      `/v1/student-profile/ticket/tickets/${id}/`,
    );
    return response.data;
  }

  async getTicketChats(params?: any) {
    const response = await this.api.get(
      "/v1/student-profile/ticket/ticket-chats/",
      { params },
    );
    return response.data;
  }

  async createTicketChat(data: any) {
    const response = await this.api.post(
      "/v1/student-profile/ticket/ticket-chats/",
      data,
    );
    return response.data;
  }

  // Stories
  async getStories(params?: any) {
    const response = await this.api.get("/v1/student-profile/stories/", {
      params,
    });
    return response.data;
  }

  async deleteStory(id: number) {
    const response = await this.api.delete(
      `/v1/student-profile/stories/${id}/`,
    );
    return response.data;
  }

  // Expenses
  async getExpenseTypes() {
    const response = await this.api.get("/v1/expense-type/");
    return response.data;
  }

  async createExpenseType(data: any) {
    const response = await this.api.post("/v1/expense-type/", data);
    return response.data;
  }

  async getExpenses(params?: {
    page?: number;
    limit?: number;
    [key: string]: any;
  }) {
    const response = await this.api.get("/v1/expense/", { params });
    return response.data;
  }

  async createExpense(data: any) {
    const response = await this.api.post("/v1/expense/", data);
    return response.data;
  }

  async updateExpense(id: number, data: any) {
    const response = await this.api.patch(`/v1/expense/${id}/`, data);
    return response.data;
  }

  async deleteExpense(id: number) {
    const response = await this.api.delete(`/v1/expense/${id}/`);
    return response.data;
  }

  // Information/Announcements
  async getInformation(params?: any) {
    const response = await this.api.get("/v1/information/", { params });
    return response.data;
  }

  async createInformation(data: any) {
    const response = await this.api.post("/v1/information/", data);
    return response.data;
  }

  async updateInformation(id: number, data: any) {
    const response = await this.api.patch(`/v1/information/${id}/`, data);
    return response.data;
  }

  async deleteInformation(id: number) {
    const response = await this.api.delete(`/v1/information/${id}/`);
    return response.data;
  }

  // Leaderboard
  async getLeaderboard(params?: any) {
    const response = await this.api.get("/v1/ranking/leaderboard/", { params });
    return response.data;
  }

  // Email Marketing
  async getEmailTemplates(params?: any) {
    const response = await this.api.get("/v1/email/templates/", { params });
    return response.data;
  }

  async createEmailTemplate(data: any) {
    const response = await this.api.post("/v1/email/templates/", data);
    return response.data;
  }

  async updateEmailTemplate(id: number, data: any) {
    const response = await this.api.patch(`/v1/email/templates/${id}/`, data);
    return response.data;
  }

  async deleteEmailTemplate(id: number) {
    const response = await this.api.delete(`/v1/email/templates/${id}/`);
    return response.data;
  }

  async getEmailCampaigns(params?: any) {
    const response = await this.api.get("/v1/email/campaigns/", { params });
    return response.data;
  }

  async createEmailCampaign(data: any) {
    const response = await this.api.post("/v1/email/campaigns/", data);
    return response.data;
  }

  async updateEmailCampaign(id: number, data: any) {
    const response = await this.api.patch(`/v1/email/campaigns/${id}/`, data);
    return response.data;
  }

  async deleteEmailCampaign(id: number) {
    const response = await this.api.delete(`/v1/email/campaigns/${id}/`);
    return response.data;
  }

  async getEmailLogs(params?: any) {
    const response = await this.api.get("/v1/email/logs/", { params });
    return response.data;
  }

  // Accounting - Student Balances
  async getStudentAccounts(params?: {
    page?: number;
    limit?: number;
    [key: string]: any;
  }) {
    const response = await this.api.get(
      "/v1/student-profile/accounting/student-accounts/",
      { params },
    );
    return response.data;
  }

  async reactivateStudentAccount(
    id: number,
    data?: { group?: number | string },
  ) {
    const response = await this.api.post(
      `/v1/student-profile/accounting/student-accounts/${id}/reactivate/`,
      data || {},
    );
    return response.data;
  }

  async getMonthlySubscriptionCharges(params?: {
    page?: number;
    limit?: number;
    [key: string]: any;
  }) {
    const response = await this.api.get(
      "/v1/student-profile/accounting/monthly-charges/",
      { params },
    );
    return response.data;
  }

  async getAccountingActivityLogs(params?: {
    page?: number;
    limit?: number;
    [key: string]: any;
  }) {
    const response = await this.api.get(
      "/v1/student-profile/accounting/activity-logs/",
      { params },
    );
    return response.data;
  }

  async getAccountingRealtimeDashboard(params?: { limit?: number }) {
    const response = await this.api.get(
      "/v1/student-profile/accounting/realtime-dashboard/",
      { params },
    );
    return response.data;
  }

  // Accounting - Student Balances
  async getStudentBalances(params?: {
    page?: number;
    limit?: number;
    [key: string]: any;
  }) {
    const response = await this.api.get(
      "/v1/student-profile/accounting/student-balances/",
      { params },
    );
    return response.data;
  }

  async getStudentBalance(id: number) {
    const response = await this.api.get(
      `/v1/student-profile/accounting/student-balances/${id}/`,
    );
    return response.data;
  }

  async updateStudentBalance(id: number, data: any) {
    const response = await this.api.patch(
      `/v1/student-profile/accounting/student-balances/${id}/`,
      data,
    );
    return response.data;
  }

  // Accounting - Teacher Earnings
  async getTeacherEarnings(params?: {
    page?: number;
    limit?: number;
    [key: string]: any;
  }) {
    const response = await this.api.get(
      "/v1/student-profile/accounting/teacher-earnings/",
      { params },
    );
    return response.data;
  }

  async getTeacherEarning(id: number) {
    const response = await this.api.get(
      `/v1/student-profile/accounting/teacher-earnings/${id}/`,
    );
    return response.data;
  }

  async getTeacherEarningsSummary(params?: { [key: string]: any }) {
    const response = await this.api.get(
      "/v1/student-profile/accounting/teacher-earnings/summary/",
      { params },
    );
    return response.data;
  }

  async markTeacherEarningPaid(id: number, data: { paid_date?: string }) {
    const response = await this.api.patch(
      `/v1/student-profile/accounting/teacher-earnings/${id}/`,
      {
        is_paid_to_teacher: true,
        ...data,
      },
    );
    return response.data;
  }

  // Accounting - Student Fines
  async getStudentFines(params?: {
    page?: number;
    limit?: number;
    [key: string]: any;
  }) {
    const response = await this.api.get(
      "/v1/student-profile/accounting/student-fines/",
      { params },
    );
    return response.data;
  }

  async getStudentFine(id: number) {
    const response = await this.api.get(
      `/v1/student-profile/accounting/student-fines/${id}/`,
    );
    return response.data;
  }

  async createStudentFine(data: any) {
    const response = await this.api.post(
      "/v1/student-profile/accounting/student-fines/",
      data,
    );
    return response.data;
  }

  async updateStudentFine(id: number, data: any) {
    const response = await this.api.patch(
      `/v1/student-profile/accounting/student-fines/${id}/`,
      data,
    );
    return response.data;
  }

  async deleteStudentFine(id: number) {
    const response = await this.api.delete(
      `/v1/student-profile/accounting/student-fines/${id}/`,
    );
    return response.data;
  }

  async markFinePaid(id: number, data: { paid_date?: string }) {
    const response = await this.api.patch(
      `/v1/student-profile/accounting/student-fines/${id}/`,
      {
        is_paid: true,
        ...data,
      },
    );
    return response.data;
  }

  // Accounting - Account Transactions
  async getAccountTransactions(params?: any) {
    const response = await this.api.get(
      "/v1/student-profile/accounting/transactions/",
      { params },
    );
    return response.data;
  }

  async getAccountTransaction(id: number) {
    const response = await this.api.get(
      `/v1/student-profile/accounting/transactions/${id}/`,
    );
    return response.data;
  }

  // Accounting - Financial Summaries
  async getFinancialSummaries(params?: any) {
    const response = await this.api.get(
      "/v1/student-profile/accounting/financial-summaries/",
      { params },
    );
    return response.data;
  }

  async getFinancialSummary(id: number) {
    const response = await this.api.get(
      `/v1/student-profile/accounting/financial-summaries/${id}/`,
    );
    return response.data;
  }

  async generateFinancialSummary(date: string) {
    const response = await this.api.post(
      "/v1/student-profile/accounting/financial-summaries/",
      { date },
    );
    return response.data;
  }

  // Global Search
  async globalSearch(query: string) {
    try {
      // Try the search endpoint - may not exist on all backends
      const response = await this.api.get("/v1/search/", { params: { query } });
      return response.data;
    } catch (error: any) {
      // If 404, search endpoint not available - return empty results
      if (error?.response?.status === 404) {
        console.warn("Search endpoint not available");
        return { students: [], teachers: [], courses: [], groups: [] };
      }
      throw error;
    }
  }

  // Chat
  async sendChatMessage(message: string, history: any[]) {
    const response = await this.api.post("/chat/", { message, history });
    return response.data;
  }

  // Logging
  async logInteraction(interaction: any) {
    try {
      await this.api.post("/log/", interaction);
    } catch (error) {
      console.error("Failed to log interaction:", error);
    }
  }

  // AI Voice Control
  async speechToText(audioBlob: Blob) {
    const formData = new FormData();
    formData.append("file", audioBlob, "voice.wav");

    const response = await this.api.post("/v1/ai/stt/", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  }

  async textToSpeech(text: string, language: string = "uz") {
    const response = await this.api.post(
      "/v1/ai/tts/",
      { text, language },
      { responseType: "blob" },
    );
    return response.data;
  }

  async processIntent(text: string) {
    const response = await this.api.post("/v1/ai/intent/", { text });
    return response.data;
  }

  async processVoiceCommand(audioBlob: Blob): Promise<{
    status: string;
    intent: string;
    confidence: number;
    message: string;
    data?: any;
    audio?: Blob;
  }> {
    try {
      // Step 1: Convert speech to text
      const sttResult = await this.speechToText(audioBlob);
      const text = sttResult.corrected || sttResult.raw;

      // Step 2: Process intent
      const intentResult = await this.processIntent(text);

      // Step 3: Get voice response (TTS)
      let audioResponse = null;
      if (intentResult.result?.message) {
        try {
          audioResponse = await this.textToSpeech(intentResult.result.message);
        } catch (error) {
          console.warn("TTS failed, continuing without audio:", error);
        }
      }

      return {
        status: intentResult.result?.status || "ok",
        intent: intentResult.nlu?.intent || "unknown",
        confidence: intentResult.nlu?.confidence || 0,
        message: intentResult.result?.message || text,
        data: intentResult.result?.data,
        audio: audioResponse,
      };
    } catch (error) {
      console.error("Voice command processing failed:", error);
      throw error;
    }
  }

  // ============= NOTIFICATIONS & INBOX =============

  async getNotifications() {
    const response = await this.api.get("/v1/student-profile/notifications/");
    return response.data;
  }

  async getUnreadNotificationCount() {
    const response = await this.api.get(
      "/v1/student-profile/notifications/unread_count/",
    );
    return response.data;
  }

  async markNotificationAsRead(id: number) {
    const response = await this.api.post(
      `/v1/student-profile/notifications/${id}/mark_read/`,
    );
    return response.data;
  }

  async markAllNotificationsAsRead() {
    const response = await this.api.post(
      "/v1/student-profile/notifications/mark_all_read/",
    );
    return response.data;
  }

  async getInboxSettings() {
    const response = await this.api.get("/v1/student-profile/inbox-settings/");
    return response.data;
  }

  async updateInboxSettings(settings: any) {
    const response = await this.api.put(
      "/v1/student-profile/inbox-settings/",
      settings,
    );
    return response.data;
  }

  // ============= EXAM DRAFTS =============

  async getExamDrafts() {
    const response = await this.api.get("/v1/student-profile/exam-drafts/");
    return response.data;
  }

  async getMyExamDrafts() {
    const response = await this.api.get(
      "/v1/student-profile/exam-drafts/my_drafts/",
    );
    return response.data;
  }

  async getPendingExamDrafts() {
    const response = await this.api.get(
      "/v1/student-profile/exam-drafts/pending_approval/",
    );
    return response.data;
  }

  async getExamDraft(id: number) {
    const response = await this.api.get(
      `/v1/student-profile/exam-drafts/${id}/`,
    );
    return response.data;
  }

  async createExamDraft(data: any) {
    const response = await this.api.post(
      "/v1/student-profile/exam-drafts/",
      data,
    );
    return response.data;
  }

  async updateExamDraft(id: number, data: any) {
    const response = await this.api.put(
      `/v1/student-profile/exam-drafts/${id}/`,
      data,
    );
    return response.data;
  }

  async deleteExamDraft(id: number) {
    const response = await this.api.delete(
      `/v1/student-profile/exam-drafts/${id}/`,
    );
    return response.data;
  }

  async submitExamDraftForReview(id: number) {
    const response = await this.api.post(
      `/v1/student-profile/exam-drafts/${id}/submit_for_review/`,
    );
    return response.data;
  }

  async submitExamDraftForApproval(id: number) {
    const response = await this.api.post(
      `/v1/student-profile/exam-drafts/${id}/submit_for_approval/`,
    );
    return response.data;
  }

  async approveOrRejectExamDraft(
    id: number,
    action: "approve" | "reject",
    comments?: string,
  ) {
    const response = await this.api.post(
      `/v1/student-profile/exam-drafts/${id}/approve_or_reject/`,
      {
        action,
        comments,
      },
    );
    return response.data;
  }

  async getExamDraftStatistics() {
    const response = await this.api.get(
      "/v1/student-profile/exam-drafts/statistics/",
    );
    return response.data;
  }

  async getExamDraftQualityReport(id: number) {
    const response = await this.api.get(
      `/v1/student-profile/exam-drafts/${id}/quality_report/`,
    );
    return response.data;
  }

  async getSATExamQualityReport(id: number) {
    const response = await this.api.get(
      `/v1/student-profile/sat/exams/${id}/quality_report/`,
    );
    return response.data;
  }

  // ============= AI EXAM GENERATION =============

  async generateExamWithAI(data: {
    section: string;
    difficulty_level: string;
    topic?: string;
    custom_instructions?: string;
  }) {
    const response = await this.api.post(
      "/v1/student-profile/ai-exam-generate/",
      data,
    );
    return response.data;
  }

  async getMyAIExamRequests() {
    const response = await this.api.get(
      "/v1/student-profile/ai-exam-generate/my_requests/",
    );
    return response.data;
  }

  async getAIExamRequest(id: number) {
    const response = await this.api.get(
      `/v1/student-profile/ai-exam-generate/${id}/`,
    );
    return response.data;
  }
}

const apiService = new ApiService();
export default apiService;

// Named export for convenience
export const api = apiService;
