import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";

export type CertType =
  | "stcw_bst"
  | "stcw_advanced"
  | "uscg_oupv"
  | "uscg_master"
  | "medical_eng1"
  | "medical_cg719k"
  | "first_aid"
  | "gmdss_rro"
  | "gmdss_goc"
  | "passport"
  | "visa"
  | "yachtmaster"
  | "icc"
  | "powerboat_l2"
  | "other";

export const CERT_TYPE_LABELS: Record<CertType, string> = {
  stcw_bst: "STCW Basic Safety Training",
  stcw_advanced: "STCW Advanced",
  uscg_oupv: "USCG OUPV (6-pack)",
  uscg_master: "USCG Master",
  medical_eng1: "ENG1 (UK MCA medical)",
  medical_cg719k: "CG-719K (USCG medical)",
  first_aid: "First aid",
  gmdss_rro: "GMDSS Restricted Operator (VHF DSC)",
  gmdss_goc: "GMDSS General Operator (HF)",
  passport: "Passport",
  visa: "Visa",
  yachtmaster: "RYA Yachtmaster",
  icc: "ICC (International Certificate of Competence)",
  powerboat_l2: "RYA Powerboat Level 2",
  other: "Other",
};

export interface Certification {
  id: string;
  crew_user_id: string | null;
  crew_name: string | null;
  cert_type: CertType;
  cert_label: string | null;
  issued_date: string | null;
  expiry_date: string;
  issuing_authority: string | null;
  document_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CertStatus {
  label: string;
  classes: string;
  Icon: typeof CheckCircle2;
}

export function statusFor(
  expiryIso: string,
  now: Date = new Date(),
): CertStatus {
  const expiry = new Date(expiryIso);
  if (!Number.isFinite(expiry.getTime())) {
    return {
      label: "Invalid date",
      classes: "text-destructive bg-destructive/10 border-destructive/30",
      Icon: AlertTriangle,
    };
  }
  const days = Math.floor(
    (expiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (days < 0)
    return {
      label: `Expired ${-days}d ago`,
      classes: "text-destructive bg-destructive/10 border-destructive/30",
      Icon: AlertTriangle,
    };
  if (days <= 30)
    return {
      label: `Expires in ${days}d`,
      classes: "text-warning bg-warning/10 border-warning/30",
      Icon: Clock,
    };
  if (days <= 90)
    return {
      label: `Expires in ${days}d`,
      classes: "text-warning bg-warning/10 border-warning/30",
      Icon: Clock,
    };
  return {
    label: `Valid until ${expiry.toISOString().slice(0, 10)}`,
    classes: "text-success bg-success/10 border-success/30",
    Icon: CheckCircle2,
  };
}

export interface FormState {
  id: string | null;
  crew_name: string;
  cert_type: CertType;
  cert_label: string;
  issued_date: string;
  expiry_date: string;
  issuing_authority: string;
  document_url: string;
  notes: string;
}

export const EMPTY_FORM: FormState = {
  id: null,
  crew_name: "",
  cert_type: "stcw_bst",
  cert_label: "",
  issued_date: "",
  expiry_date: "",
  issuing_authority: "",
  document_url: "",
  notes: "",
};
