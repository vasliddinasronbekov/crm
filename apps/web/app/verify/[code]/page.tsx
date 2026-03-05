"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { useParams } from "next/navigation";
import apiService from "@/lib/api";
import {
  AlertCircle,
  Award,
  CheckCircle,
  Loader2,
  ShieldCheck,
} from "lucide-react";

interface VerifiedCertificate {
  certificate_id: string;
  student_name: string;
  course_name: string;
  template_name?: string;
  issued_date: string;
  completion_date: string;
  grade: string;
  hours_completed: number;
  verification_code: string;
  issued_by_name?: string;
}

function getErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data;
    if (typeof detail === "string") return detail;
    if (detail?.error) return detail.error;
    if (detail?.detail) return detail.detail;
  }
  if (error instanceof Error) return error.message;
  return "Unable to verify certificate";
}

export default function CertificateVerifyPage() {
  const params = useParams<{ code: string }>();
  const code = Array.isArray(params?.code) ? params.code[0] : params?.code;

  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [certificate, setCertificate] = useState<VerifiedCertificate | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!code) return;

    let cancelled = false;

    const verifyCertificate = async () => {
      try {
        setLoading(true);
        const data = await apiService.verifyCertificate({ code });
        if (!cancelled) {
          setVerified(Boolean(data?.verified));
          setCertificate(data?.certificate || null);
          setErrorMessage("");
        }
      } catch (error) {
        if (!cancelled) {
          setVerified(false);
          setCertificate(null);
          setErrorMessage(getErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void verifyCertificate();

    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          <h1 className="mb-3 flex items-center justify-center gap-3 text-3xl font-bold">
            <ShieldCheck className="h-8 w-8 text-primary" />
            Certificate Verification
          </h1>
          <p className="text-text-secondary">
            Validate certificate authenticity using the embedded certificate ID
            or verification code.
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-surface p-8 shadow-sm">
          {loading ? (
            <div className="py-20 text-center">
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
              <p className="mt-4 text-text-secondary">
                Checking certificate...
              </p>
            </div>
          ) : verified && certificate ? (
            <>
              <div className="mb-6 flex items-center gap-4 rounded-2xl border border-success/30 bg-success/10 p-5">
                <CheckCircle className="h-8 w-8 text-success" />
                <div>
                  <p className="font-semibold text-success">
                    Certificate verified
                  </p>
                  <p className="text-sm text-text-secondary">
                    This certificate exists in the system and has not been
                    revoked.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-background p-5">
                  <p className="text-sm text-text-secondary">Student</p>
                  <p className="mt-1 text-lg font-semibold">
                    {certificate.student_name}
                  </p>
                </div>
                <div className="rounded-2xl bg-background p-5">
                  <p className="text-sm text-text-secondary">Course</p>
                  <p className="mt-1 text-lg font-semibold">
                    {certificate.course_name}
                  </p>
                </div>
                <div className="rounded-2xl bg-background p-5">
                  <p className="text-sm text-text-secondary">Issued date</p>
                  <p className="mt-1 font-semibold">
                    {new Date(certificate.issued_date).toLocaleDateString()}
                  </p>
                </div>
                <div className="rounded-2xl bg-background p-5">
                  <p className="text-sm text-text-secondary">Completion date</p>
                  <p className="mt-1 font-semibold">
                    {new Date(certificate.completion_date).toLocaleDateString()}
                  </p>
                </div>
                <div className="rounded-2xl bg-background p-5">
                  <p className="text-sm text-text-secondary">Grade</p>
                  <p className="mt-1 font-semibold">
                    {certificate.grade || "Not set"}
                  </p>
                </div>
                <div className="rounded-2xl bg-background p-5">
                  <p className="text-sm text-text-secondary">Hours completed</p>
                  <p className="mt-1 font-semibold">
                    {certificate.hours_completed || 0}
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-border bg-background p-5">
                <p className="text-sm text-text-secondary">Verification code</p>
                <p className="mt-2 font-mono text-xl font-semibold">
                  {certificate.verification_code}
                </p>
              </div>
            </>
          ) : (
            <div className="py-12 text-center">
              <AlertCircle className="mx-auto h-16 w-16 text-error" />
              <p className="mt-4 text-xl font-semibold">
                Certificate not found
              </p>
              <p className="mt-2 text-text-secondary">
                {errorMessage ||
                  "The code does not match any certificate in the system."}
              </p>
            </div>
          )}
        </div>

        <div className="mt-8 text-center text-sm text-text-secondary">
          <Award className="mr-2 inline h-4 w-4" />
          Presented by Edu Platform
        </div>
      </div>
    </div>
  );
}