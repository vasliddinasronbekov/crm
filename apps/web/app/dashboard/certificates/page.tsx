"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import apiService from "@/lib/api";
import { toast } from "react-hot-toast";
import {
  AlertCircle,
  Award,
  CheckCircle,
  Copy,
  Download,
  Edit,
  Eye,
  FileText,
  Loader2,
  Plus,
  QrCode,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import CertificateEditorWrapper from "@/components/CertificateEditor";
import { CertificateTemplate } from "@/lib/types";

interface Certificate {
  id: number;
  certificate_id: string;
  student: number;
  course: number;
  template: number | null;
  student_name: string;
  course_name: string;
  template_name?: string;
  issued_date: string;
  completion_date: string;
  grade: string;
  hours_completed: number;
  certificate_url?: string | null;
  download_url?: string | null;
  is_verified: boolean;
  verification_url?: string;
  verification_code: string;
  issued_by?: number | null;
  issued_by_name?: string;
  notes?: string;
  verification_count?: number;
  last_verified_at?: string | null;
  created_at: string;
  updated_at?: string;
}

interface Student {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  username?: string;
}

interface Course {
  id: number;
  name: string;
}

interface CertificateEligibility {
  eligible: boolean;
  ready_for_issue: boolean;
  student: {
    id: number;
    name: string;
    username: string;
    email: string;
  };
  course: {
    id: number;
    name: string;
  };
  enrollment: {
    is_enrolled: boolean;
    group_names: string[];
    group_count: number;
  };
  progress: {
    completed_lessons: number;
    total_lessons: number;
    completion_rate: number;
  };
  attendance: {
    present_sessions: number;
    total_sessions: number;
    attendance_rate: number;
  };
  exams: {
    attempt_count: number;
    average_score: number;
  };
  existing_certificate?: Certificate | null;
}

interface CertificateFormState {
  student_id: number;
  course_id: number;
  template_id: number;
  completion_date: string;
  grade: string;
  hours_completed: number;
  notes: string;
  force_regenerate: boolean;
}

const emptyCertificateForm: CertificateFormState = {
  student_id: 0,
  course_id: 0,
  template_id: 0,
  completion_date: new Date().toISOString().split("T")[0],
  grade: "",
  hours_completed: 0,
  notes: "",
  force_regenerate: false,
};

function getErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data;
    if (typeof detail === "string") return detail;
    if (detail?.error) return detail.error;
    if (detail?.detail) return detail.detail;
    if (detail && typeof detail === "object") {
      const firstEntry = Object.values(detail)[0];
      if (Array.isArray(firstEntry)) return String(firstEntry[0]);
      if (typeof firstEntry === "string") return firstEntry;
    }
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong";
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.URL.revokeObjectURL(url);
}

function buildVerificationLink(
  certificate: Pick<Certificate, "verification_url" | "certificate_id">,
) {
  if (certificate.verification_url) {
    return certificate.verification_url;
  }
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/verify/${certificate.certificate_id}`;
}

export default function CertificatesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"certificates" | "templates">(
    "certificates",
  );
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCertModal, setShowCertModal] = useState(false);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] =
    useState<CertificateTemplate | null>(null);
  const [selectedCert, setSelectedCert] = useState<Certificate | null>(null);

  const [certForm, setCertForm] =
    useState<CertificateFormState>(emptyCertificateForm);
  const [eligibility, setEligibility] = useState<CertificateEligibility | null>(
    null,
  );
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [submittingCertificate, setSubmittingCertificate] = useState(false);
  const [downloadId, setDownloadId] = useState<number | null>(null);
  const [regenerateId, setRegenerateId] = useState<number | null>(null);
  const [templateActionId, setTemplateActionId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push("/login");
        return;
      }

      if (!user.is_staff && !user.is_superuser && !user.is_teacher) {
        router.push("/dashboard");
        toast.error("Access denied");
        return;
      }

      void loadData();
    }
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!showCertModal || !certForm.student_id || !certForm.course_id) {
      setEligibility(null);
      return;
    }

    let cancelled = false;

    const loadEligibility = async () => {
      try {
        setEligibilityLoading(true);
        const data = await apiService.getCertificateEligibility({
          student_id: certForm.student_id,
          course_id: certForm.course_id,
        });
        if (!cancelled) {
          setEligibility(data);
          if (data.existing_certificate) {
            setCertForm((prev) => ({
              ...prev,
              grade: prev.grade || data.existing_certificate?.grade || "",
              hours_completed:
                prev.hours_completed ||
                data.existing_certificate?.hours_completed ||
                0,
              notes: prev.notes || data.existing_certificate?.notes || "",
              force_regenerate: true,
            }));
          }
        }
      } catch (error) {
        if (!cancelled) {
          setEligibility(null);
          toast.error(getErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setEligibilityLoading(false);
        }
      }
    };

    void loadEligibility();

    return () => {
      cancelled = true;
    };
  }, [certForm.course_id, certForm.student_id, showCertModal]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadCertificates(),
        loadTemplates(),
        loadStudents(),
        loadCourses(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadCertificates = async () => {
    const data = await apiService.getCertificates();
    setCertificates(data.results || data);
  };

  const loadTemplates = async () => {
    const data = await apiService.getCertificateTemplates();
    setTemplates(data.results || data);
  };

  const loadStudents = async () => {
    const data = await apiService.getStudents();
    setStudents(data.results || data);
  };

  const loadCourses = async () => {
    const data = await apiService.getCourses();
    setCourses(data.results || data);
  };

  const closeIssueModal = () => {
    setShowCertModal(false);
    setCertForm(emptyCertificateForm);
    setEligibility(null);
  };

  const handleCreateCertificate = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSubmittingCertificate(true);
      const payload = {
        student_id: certForm.student_id,
        course_id: certForm.course_id,
        template_id: certForm.template_id || undefined,
        completion_date: certForm.completion_date,
        grade: certForm.grade.trim(),
        hours_completed: Number(certForm.hours_completed || 0),
        notes: certForm.notes.trim(),
        force_regenerate: certForm.force_regenerate,
      };

      const response = await apiService.generateCertificate(payload);
      const wasReissued = certificates.some(
        (certificate) =>
          certificate.student === payload.student_id &&
          certificate.course === payload.course_id,
      );
      toast.success(
        wasReissued
          ? "Certificate reissued successfully"
          : "Certificate issued successfully",
      );
      closeIssueModal();
      setSelectedCert(response);
      await loadCertificates();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmittingCertificate(false);
    }
  };

  const handleDeleteCertificate = async (id: number) => {
    if (
      !confirm("Delete this certificate? This removes the record and PDF file.")
    ) {
      return;
    }

    try {
      await apiService.deleteCertificate(id);
      toast.success("Certificate deleted");
      await loadCertificates();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleDownloadCertificate = async (certificate: Certificate) => {
    try {
      setDownloadId(certificate.id);
      const blob = await apiService.downloadCertificate(certificate.id);
      downloadBlob(blob, `certificate-${certificate.verification_code}.pdf`);
      toast.success("Certificate downloaded");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDownloadId(null);
    }
  };

  const handleRegenerateCertificate = async (certificate: Certificate) => {
    try {
      setRegenerateId(certificate.id);
      const regenerated = await apiService.regenerateCertificate(
        certificate.id,
      );
      toast.success("Certificate regenerated");
      setSelectedCert(regenerated);
      await loadCertificates();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setRegenerateId(null);
    }
  };

  const handleSaveTemplate = async (templateData: FormData) => {
    try {
      const shouldBeDefault = templateData.get("is_default") === "true";

      if (editingTemplate?.id) {
        const updated = await apiService.updateCertificateTemplate(
          editingTemplate.id,
          templateData,
        );
        if (shouldBeDefault && updated?.id) {
          await apiService.setDefaultCertificateTemplate(updated.id);
        }
        toast.success("Template updated");
      } else {
        const created =
          await apiService.createCertificateTemplate(templateData);
        if (shouldBeDefault && created?.id) {
          await apiService.setDefaultCertificateTemplate(created.id);
        }
        toast.success("Template created");
      }

      setShowTemplateEditor(false);
      setEditingTemplate(null);
      await loadTemplates();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!confirm("Delete this template?")) {
      return;
    }

    try {
      await apiService.deleteCertificateTemplate(id);
      toast.success("Template deleted");
      await loadTemplates();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleSetDefaultTemplate = async (templateId: number) => {
    try {
      setTemplateActionId(templateId);
      await apiService.setDefaultCertificateTemplate(templateId);
      toast.success("Default template updated");
      await loadTemplates();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setTemplateActionId(null);
    }
  };

  const handleCopyVerificationLink = async (certificate: Certificate) => {
    const link = buildVerificationLink(certificate);
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Verification link copied");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const filteredCertificates = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    if (!normalized) return certificates;

    return certificates.filter((certificate) =>
      [
        certificate.student_name,
        certificate.course_name,
        certificate.template_name,
        certificate.verification_code,
        certificate.certificate_id,
        certificate.issued_by_name,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized)),
    );
  }, [certificates, searchTerm]);

  const filteredTemplates = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    if (!normalized) return templates;

    return templates.filter((template) =>
      [template.name, template.template_type]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized)),
    );
  }, [searchTerm, templates]);

  const stats = useMemo(() => {
    const thisMonth = new Date().getMonth();

    return {
      totalCertificates: certificates.length,
      verifiedCertificates: certificates.filter(
        (certificate) => certificate.is_verified,
      ).length,
      activeTemplates: templates.filter((template) => template.is_active)
        .length,
      issuedThisMonth: certificates.filter(
        (certificate) =>
          new Date(certificate.issued_date).getMonth() === thisMonth,
      ).length,
    };
  }, [certificates, templates]);

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
          <p className="mt-4 text-text-secondary">Loading certificates...</p>
        </div>
      </div>
    );
  }

  if (showTemplateEditor) {
    return (
      <CertificateEditorWrapper
        template={editingTemplate}
        onSave={handleSaveTemplate}
        onClose={() => {
          setShowTemplateEditor(false);
          setEditingTemplate(null);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="mb-2 flex items-center gap-3 text-3xl font-bold">
              <Award className="h-8 w-8 text-primary" />
              Certificates Management
            </h1>
            <p className="max-w-3xl text-text-secondary">
              Manage certificate templates, verify issue readiness, and generate
              downloadable certificates with verification metadata.
            </p>
          </div>
          <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-text-secondary">
            Public verification route:{" "}
            <span className="font-mono text-text-primary">
              /verify/[certificate-id]
            </span>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-4">
          <div className="rounded-2xl border border-border bg-surface p-6">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm text-text-secondary">Total Certificates</p>
              <Award className="h-5 w-5 text-primary" />
            </div>
            <p className="text-3xl font-bold">{stats.totalCertificates}</p>
            <p className="mt-1 text-xs text-text-secondary">
              All issued records
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-6">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm text-text-secondary">Verified</p>
              <ShieldCheck className="h-5 w-5 text-success" />
            </div>
            <p className="text-3xl font-bold">{stats.verifiedCertificates}</p>
            <p className="mt-1 text-xs text-text-secondary">
              Certificates available for public validation
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-6">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm text-text-secondary">Active Templates</p>
              <FileText className="h-5 w-5 text-info" />
            </div>
            <p className="text-3xl font-bold">{stats.activeTemplates}</p>
            <p className="mt-1 text-xs text-text-secondary">
              Reusable layout presets
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-6">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm text-text-secondary">Issued This Month</p>
              <Users className="h-5 w-5 text-warning" />
            </div>
            <p className="text-3xl font-bold">{stats.issuedThisMonth}</p>
            <p className="mt-1 text-xs text-text-secondary">
              Current month activity
            </p>
          </div>
        </div>

        <div className="mb-6 flex gap-2 border-b border-border">
          <button
            onClick={() => setActiveTab("certificates")}
            className={`border-b-2 px-6 py-3 font-medium transition-colors ${
              activeTab === "certificates"
                ? "border-primary text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            <Award className="mr-2 inline h-4 w-4" />
            Certificates
          </button>
          <button
            onClick={() => setActiveTab("templates")}
            className={`border-b-2 px-6 py-3 font-medium transition-colors ${
              activeTab === "templates"
                ? "border-primary text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            <FileText className="mr-2 inline h-4 w-4" />
            Templates
          </button>
        </div>

        <div className="mb-6 rounded-2xl border border-border bg-surface p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-text-secondary" />
              <input
                type="text"
                placeholder={
                  activeTab === "certificates"
                    ? "Search by student, course, template, verification code..."
                    : "Search templates..."
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-border bg-background py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            {activeTab === "certificates" ? (
              <button
                onClick={() => {
                  setCertForm(emptyCertificateForm);
                  setEligibility(null);
                  setShowCertModal(true);
                }}
                className="flex items-center gap-2 rounded-xl bg-primary px-4 py-3 font-medium text-background transition-colors hover:bg-primary/90"
              >
                <Plus className="h-5 w-5" />
                Issue Certificate
              </button>
            ) : (
              <button
                onClick={() => {
                  setEditingTemplate(null);
                  setShowTemplateEditor(true);
                }}
                className="flex items-center gap-2 rounded-xl bg-primary px-4 py-3 font-medium text-background transition-colors hover:bg-primary/90"
              >
                <Plus className="h-5 w-5" />
                Create Template
              </button>
            )}
          </div>
        </div>

        {activeTab === "certificates" && (
          <>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              {filteredCertificates.map((certificate) => (
                <div
                  key={certificate.id}
                  className="rounded-2xl border border-border bg-surface p-6 transition-colors hover:border-primary/40"
                >
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                          <Award className="h-3.5 w-3.5" />
                          {certificate.template_name || "Template pending"}
                        </span>
                        {certificate.is_verified && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
                            <CheckCircle className="h-3.5 w-3.5" />
                            Verified
                          </span>
                        )}
                      </div>
                      <h3 className="text-xl font-bold">
                        {certificate.course_name}
                      </h3>
                      <p className="mt-1 text-sm text-text-secondary">
                        {certificate.student_name}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedCert(certificate)}
                      className="rounded-xl bg-background p-3 text-text-secondary transition-colors hover:text-primary"
                      title="Open verification details"
                    >
                      <Eye className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-background p-3">
                      <p className="text-text-secondary">Issued Date</p>
                      <p className="mt-1 font-medium">
                        {new Date(certificate.issued_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="rounded-xl bg-background p-3">
                      <p className="text-text-secondary">Completion Date</p>
                      <p className="mt-1 font-medium">
                        {new Date(
                          certificate.completion_date,
                        ).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="rounded-xl bg-background p-3">
                      <p className="text-text-secondary">Grade</p>
                      <p className="mt-1 font-medium">
                        {certificate.grade || "Not set"}
                      </p>
                    </div>
                    <div className="rounded-xl bg-background p-3">
                      <p className="text-text-secondary">Hours</p>
                      <p className="mt-1 font-medium">
                        {certificate.hours_completed || 0}
                      </p>
                    </div>
                  </div>

                  <div className="mb-5 space-y-2 text-sm text-text-secondary">
                    <p>
                      <span className="font-medium text-text-primary">
                        Verification code:
                      </span>{" "}
                      <span className="font-mono">
                        {certificate.verification_code}
                      </span>
                    </p>
                    <p>
                      <span className="font-medium text-text-primary">
                        Issued by:
                      </span>{" "}
                      {certificate.issued_by_name || "System"}
                    </p>
                    <p>
                      <span className="font-medium text-text-primary">
                        Verifications:
                      </span>{" "}
                      {certificate.verification_count || 0}
                      {certificate.last_verified_at
                        ? ` • last ${new Date(certificate.last_verified_at).toLocaleString()}`
                        : ""}
                    </p>
                    {certificate.notes && (
                      <p>
                        <span className="font-medium text-text-primary">
                          Notes:
                        </span>{" "}
                        {certificate.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleDownloadCertificate(certificate)}
                      disabled={downloadId === certificate.id}
                      className="flex items-center gap-2 rounded-xl bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-60"
                    >
                      {downloadId === certificate.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      Download PDF
                    </button>
                    <button
                      onClick={() => handleRegenerateCertificate(certificate)}
                      disabled={regenerateId === certificate.id}
                      className="flex items-center gap-2 rounded-xl bg-info/10 px-4 py-2 text-sm font-medium text-info transition-colors hover:bg-info/20 disabled:opacity-60"
                    >
                      {regenerateId === certificate.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCcw className="h-4 w-4" />
                      )}
                      Regenerate
                    </button>
                    <button
                      onClick={() => handleCopyVerificationLink(certificate)}
                      className="flex items-center gap-2 rounded-xl bg-warning/10 px-4 py-2 text-sm font-medium text-warning transition-colors hover:bg-warning/20"
                    >
                      <Copy className="h-4 w-4" />
                      Copy verify link
                    </button>
                    <button
                      onClick={() => handleDeleteCertificate(certificate.id)}
                      className="rounded-xl bg-error/10 px-3 py-2 text-error transition-colors hover:bg-error/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {filteredCertificates.length === 0 && (
              <div className="py-14 text-center">
                <Award className="mx-auto mb-4 h-16 w-16 text-text-secondary/40" />
                <p className="text-text-secondary">
                  No certificates found for the current filters.
                </p>
              </div>
            )}
          </>
        )}

        {activeTab === "templates" && (
          <>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              {filteredTemplates.map((template) => {
                const previewBackground =
                  template.background_image_url ||
                  (typeof template.background_image === "string"
                    ? template.background_image
                    : null);

                return (
                  <div
                    key={template.id}
                    className="overflow-hidden rounded-2xl border border-border bg-surface transition-colors hover:border-primary/40"
                  >
                    <div
                      className="h-36 w-full border-b border-border"
                      style={{
                        backgroundColor: template.background_color || "#ffffff",
                        backgroundImage: previewBackground
                          ? `url(${previewBackground})`
                          : "none",
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }}
                    />
                    <div className="p-6">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold">{template.name}</h3>
                        {template.is_default && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                            <Sparkles className="h-3.5 w-3.5" />
                            Default
                          </span>
                        )}
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            template.is_active
                              ? "bg-success/10 text-success"
                              : "bg-error/10 text-error"
                          }`}
                        >
                          {template.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>

                      <div className="mb-4 space-y-2 text-sm text-text-secondary">
                        <p>
                          Type:{" "}
                          <span className="capitalize text-text-primary">
                            {template.template_type || "standard"}
                          </span>
                        </p>
                        <p>
                          Certificates issued:{" "}
                          <span className="text-text-primary">
                            {template.certificate_count || 0}
                          </span>
                        </p>
                        <p>
                          Created:{" "}
                          <span className="text-text-primary">
                            {template.created_at
                              ? new Date(
                                  template.created_at,
                                ).toLocaleDateString()
                              : "—"}
                          </span>
                        </p>
                      </div>

                      <div className="mb-5 flex gap-2">
                        <div
                          className="h-8 w-8 rounded-full border border-border"
                          style={{
                            backgroundColor:
                              template.background_color || "#ffffff",
                          }}
                          title="Background color"
                        />
                        <div
                          className="h-8 w-8 rounded-full border border-border"
                          style={{
                            backgroundColor: template.text_color || "#111827",
                          }}
                          title="Text color"
                        />
                        <div
                          className="h-8 w-8 rounded-full border border-border"
                          style={{
                            backgroundColor: template.border_color || "#DAA520",
                          }}
                          title="Border color"
                        />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => {
                            setEditingTemplate(template);
                            setShowTemplateEditor(true);
                          }}
                          className="flex items-center gap-2 rounded-xl bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
                        >
                          <Edit className="h-4 w-4" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleSetDefaultTemplate(template.id!)}
                          disabled={
                            template.is_default ||
                            templateActionId === template.id
                          }
                          className="flex items-center gap-2 rounded-xl bg-info/10 px-4 py-2 text-sm font-medium text-info transition-colors hover:bg-info/20 disabled:opacity-60"
                        >
                          {templateActionId === template.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                          Set default
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(template.id!)}
                          className="rounded-xl bg-error/10 px-3 py-2 text-error transition-colors hover:bg-error/20"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredTemplates.length === 0 && (
              <div className="py-14 text-center">
                <FileText className="mx-auto mb-4 h-16 w-16 text-text-secondary/40" />
                <p className="text-text-secondary">
                  No templates found for the current filters.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {showCertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="flex items-center justify-between border-b border-border p-6">
              <div>
                <h2 className="text-xl font-bold">Issue Certificate</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  Review student activity before issuing or reissuing the final
                  certificate.
                </p>
              </div>
              <button
                onClick={closeIssueModal}
                className="rounded-xl p-2 transition-colors hover:bg-background"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid max-h-[calc(90vh-88px)] grid-cols-1 overflow-y-auto lg:grid-cols-[1.25fr_1fr]">
              <form
                onSubmit={handleCreateCertificate}
                className="space-y-4 p-6"
              >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Student
                    </label>
                    <select
                      value={certForm.student_id}
                      onChange={(e) =>
                        setCertForm((prev) => ({
                          ...prev,
                          student_id: Number(e.target.value),
                        }))
                      }
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                      required
                    >
                      <option value={0}>Select student...</option>
                      {students.map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.first_name} {student.last_name} (
                          {student.email})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Course
                    </label>
                    <select
                      value={certForm.course_id}
                      onChange={(e) =>
                        setCertForm((prev) => ({
                          ...prev,
                          course_id: Number(e.target.value),
                        }))
                      }
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                      required
                    >
                      <option value={0}>Select course...</option>
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Template
                    </label>
                    <select
                      value={certForm.template_id}
                      onChange={(e) =>
                        setCertForm((prev) => ({
                          ...prev,
                          template_id: Number(e.target.value),
                        }))
                      }
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value={0}>Use default active template</option>
                      {templates
                        .filter((template) => template.is_active)
                        .map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name}
                            {template.is_default ? " (Default)" : ""}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Completion date
                    </label>
                    <input
                      type="date"
                      value={certForm.completion_date}
                      onChange={(e) =>
                        setCertForm((prev) => ({
                          ...prev,
                          completion_date: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Grade
                    </label>
                    <input
                      type="text"
                      value={certForm.grade}
                      onChange={(e) =>
                        setCertForm((prev) => ({
                          ...prev,
                          grade: e.target.value,
                        }))
                      }
                      placeholder="A+, 95%, Distinction..."
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Hours completed
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={certForm.hours_completed}
                      onChange={(e) =>
                        setCertForm((prev) => ({
                          ...prev,
                          hours_completed: Number(e.target.value),
                        }))
                      }
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Notes
                  </label>
                  <textarea
                    value={certForm.notes}
                    onChange={(e) =>
                      setCertForm((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                    rows={4}
                    placeholder="Optional internal note about issue or reissue reason..."
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <label className="flex items-start gap-3 rounded-xl border border-border bg-background p-4">
                  <input
                    type="checkbox"
                    checked={certForm.force_regenerate}
                    onChange={(e) =>
                      setCertForm((prev) => ({
                        ...prev,
                        force_regenerate: e.target.checked,
                      }))
                    }
                    className="mt-1 h-4 w-4 rounded border-border"
                  />
                  <span className="text-sm text-text-secondary">
                    Force regenerate PDF even if the certificate already exists.
                    Use this when template layout or certificate copy changed.
                  </span>
                </label>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeIssueModal}
                    className="flex-1 rounded-xl border border-border bg-background px-6 py-3 font-medium transition-colors hover:bg-border/40"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingCertificate}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-medium text-background transition-colors hover:bg-primary/90 disabled:opacity-60"
                  >
                    {submittingCertificate && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    {eligibility?.existing_certificate
                      ? "Reissue certificate"
                      : "Issue certificate"}
                  </button>
                </div>
              </form>

              <div className="border-l border-border bg-background/50 p-6">
                <div className="mb-4 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Issue Readiness</h3>
                </div>

                {!certForm.student_id || !certForm.course_id ? (
                  <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-text-secondary">
                    Select a student and course to inspect progress, attendance,
                    exams, and any existing certificate.
                  </div>
                ) : eligibilityLoading ? (
                  <div className="flex items-center gap-3 rounded-2xl border border-border p-6 text-sm text-text-secondary">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading eligibility context...
                  </div>
                ) : eligibility ? (
                  <div className="space-y-4">
                    <div
                      className={`rounded-2xl border p-4 ${
                        eligibility.ready_for_issue
                          ? "border-success/30 bg-success/10"
                          : eligibility.eligible
                            ? "border-warning/30 bg-warning/10"
                            : "border-error/30 bg-error/10"
                      }`}
                    >
                      <div className="mb-2 flex items-center gap-2">
                        {eligibility.ready_for_issue ? (
                          <CheckCircle className="h-5 w-5 text-success" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-warning" />
                        )}
                        <p className="font-semibold">
                          {eligibility.ready_for_issue
                            ? "Ready to issue"
                            : eligibility.eligible
                              ? "Manual issue possible"
                              : "No learning activity found"}
                        </p>
                      </div>
                      <p className="text-sm text-text-secondary">
                        {eligibility.ready_for_issue
                          ? "The student has enough learning data to justify certificate issuance."
                          : eligibility.eligible
                            ? "The student has some activity. Admin review is recommended before issuing."
                            : "There is no enrollment, progress, attendance, or exam signal for this course."}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-border bg-surface p-4">
                        <p className="text-sm text-text-secondary">Progress</p>
                        <p className="mt-1 text-2xl font-bold">
                          {eligibility.progress.completion_rate}%
                        </p>
                        <p className="mt-1 text-xs text-text-secondary">
                          {eligibility.progress.completed_lessons}/
                          {eligibility.progress.total_lessons} lessons
                        </p>
                      </div>
                      <div className="rounded-xl border border-border bg-surface p-4">
                        <p className="text-sm text-text-secondary">
                          Attendance
                        </p>
                        <p className="mt-1 text-2xl font-bold">
                          {eligibility.attendance.attendance_rate}%
                        </p>
                        <p className="mt-1 text-xs text-text-secondary">
                          {eligibility.attendance.present_sessions}/
                          {eligibility.attendance.total_sessions} sessions
                        </p>
                      </div>
                      <div className="rounded-xl border border-border bg-surface p-4">
                        <p className="text-sm text-text-secondary">
                          Exam Average
                        </p>
                        <p className="mt-1 text-2xl font-bold">
                          {eligibility.exams.average_score}
                        </p>
                        <p className="mt-1 text-xs text-text-secondary">
                          {eligibility.exams.attempt_count} exam attempts
                        </p>
                      </div>
                      <div className="rounded-xl border border-border bg-surface p-4">
                        <p className="text-sm text-text-secondary">
                          Enrollment
                        </p>
                        <p className="mt-1 text-2xl font-bold">
                          {eligibility.enrollment.group_count}
                        </p>
                        <p className="mt-1 text-xs text-text-secondary">
                          {eligibility.enrollment.is_enrolled
                            ? "Active group membership"
                            : "No group enrollment"}
                        </p>
                      </div>
                    </div>

                    {eligibility.enrollment.group_names.length > 0 && (
                      <div className="rounded-xl border border-border bg-surface p-4">
                        <p className="mb-2 text-sm font-medium text-text-primary">
                          Groups
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {eligibility.enrollment.group_names.map(
                            (groupName) => (
                              <span
                                key={groupName}
                                className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                              >
                                {groupName}
                              </span>
                            ),
                          )}
                        </div>
                      </div>
                    )}

                    {eligibility.existing_certificate && (
                      <div className="rounded-xl border border-info/30 bg-info/10 p-4">
                        <p className="mb-1 text-sm font-semibold text-info">
                          Existing certificate
                        </p>
                        <p className="text-sm text-text-secondary">
                          Issued on{" "}
                          {new Date(
                            eligibility.existing_certificate.issued_date,
                          ).toLocaleDateString()}
                          {" • "}
                          Code{" "}
                          {eligibility.existing_certificate.verification_code}
                        </p>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedCert && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedCert(null)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-border bg-surface p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-center gap-4">
              <div className="rounded-2xl bg-primary/10 p-4 text-primary">
                <QrCode className="h-8 w-8" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Certificate Verification</h2>
                <p className="text-text-secondary">
                  Share this link or code so third parties can validate the
                  certificate.
                </p>
              </div>
            </div>

            <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl bg-background p-4">
                <p className="text-sm text-text-secondary">Student</p>
                <p className="mt-1 font-semibold">
                  {selectedCert.student_name}
                </p>
              </div>
              <div className="rounded-xl bg-background p-4">
                <p className="text-sm text-text-secondary">Course</p>
                <p className="mt-1 font-semibold">{selectedCert.course_name}</p>
              </div>
              <div className="rounded-xl bg-background p-4">
                <p className="text-sm text-text-secondary">Certificate ID</p>
                <p className="mt-1 break-all font-mono text-sm">
                  {selectedCert.certificate_id}
                </p>
              </div>
              <div className="rounded-xl bg-background p-4">
                <p className="text-sm text-text-secondary">Verification code</p>
                <p className="mt-1 font-mono text-lg font-semibold">
                  {selectedCert.verification_code}
                </p>
              </div>
            </div>

            <div className="mb-6 rounded-xl border border-border bg-background p-4">
              <p className="mb-2 text-sm text-text-secondary">
                Verification URL
              </p>
              <p className="break-all font-mono text-sm text-text-primary">
                {buildVerificationLink(selectedCert)}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => handleCopyVerificationLink(selectedCert)}
                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-medium text-background transition-colors hover:bg-primary/90"
              >
                <Copy className="h-4 w-4" />
                Copy verification link
              </button>
              <button
                onClick={() =>
                  window.open(
                    `/verify/${selectedCert.certificate_id}`,
                    "_blank",
                  )
                }
                className="flex items-center gap-2 rounded-xl bg-info/10 px-5 py-3 font-medium text-info transition-colors hover:bg-info/20"
              >
                <Eye className="h-4 w-4" />
                Open public verification
              </button>
              <button
                onClick={() => setSelectedCert(null)}
                className="rounded-xl border border-border px-5 py-3 font-medium transition-colors hover:bg-background"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
