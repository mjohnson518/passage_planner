import PDFDocument from "pdfkit";

// ============================================================================
// LogbookPdfService (V3) — end-of-passage PDF export
//
// Honest design: the rendered PDF is a CHRONOLOGICAL DOCUMENT, not a notes
// dump. Entries appear in `occurred_at` order. When `occurred_at` and
// `recorded_at` differ (after-the-fact entries — common offshore when the
// OOW writes up the squall once it passes) BOTH timestamps are shown so the
// time-of-event vs time-of-record distinction is preserved. This matters in
// SAR / insurance review.
//
// No branding overload — this PDF may be forwarded to authorities. Info
// first, branding minimal.
// ============================================================================

export interface LogbookEntry {
  id: string;
  passage_id: string;
  entry_type: string;
  occurred_at: string;
  recorded_at: string;
  recorded_by: string | null;
  position_lat: number | null;
  position_lon: number | null;
  conditions: Record<string, unknown> | null;
  notes: string | null;
}

export interface LogbookPdfInput {
  vesselName: string;
  passageName: string;
  departurePort: string;
  destinationPort: string;
  distanceNm: number | null;
  entries: LogbookEntry[];
  generatedAt: Date;
}

export class LogbookPdfService {
  async render(input: LogbookPdfInput): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: "LETTER",
        margins: { top: 54, bottom: 54, left: 54, right: 54 },
        info: {
          Title: `Logbook — ${input.vesselName} — ${input.passageName}`,
          Author: "Helmwise",
          Subject: "Maritime passage logbook",
        },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      this.writeHeader(doc, input);
      this.writeEntries(doc, input.entries);
      this.writeFooter(doc, input);
      doc.end();
    });
  }

  private writeHeader(doc: PDFKit.PDFDocument, input: LogbookPdfInput): void {
    doc.fontSize(20).font("Helvetica-Bold").text("LOGBOOK", { align: "left" });
    doc.moveDown(0.25);
    doc
      .fontSize(11)
      .font("Helvetica")
      .text(`Vessel: ${input.vesselName}`)
      .text(`Passage: ${input.passageName}`)
      .text(`From: ${input.departurePort}`)
      .text(`To: ${input.destinationPort}`);
    if (input.distanceNm !== null) {
      doc.text(`Distance: ${input.distanceNm.toFixed(1)} nm`);
    }
    doc.moveDown(0.5);

    // Separator line
    doc.moveTo(54, doc.y).lineTo(558, doc.y).strokeColor("#999").stroke();
    doc.moveDown(0.5);

    if (input.entries.length === 0) {
      doc
        .fontSize(11)
        .fillColor("#666")
        .text("No logbook entries recorded.")
        .fillColor("#000");
    }
  }

  private writeEntries(doc: PDFKit.PDFDocument, entries: LogbookEntry[]): void {
    // Sort by occurred_at ASC so the PDF reads chronologically.
    const sorted = [...entries].sort(
      (a, b) =>
        new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime(),
    );

    for (const e of sorted) {
      this.writeEntry(doc, e);
    }
  }

  private writeEntry(doc: PDFKit.PDFDocument, e: LogbookEntry): void {
    const occurredAt = new Date(e.occurred_at);
    const recordedAt = new Date(e.recorded_at);
    const sameTime =
      Math.abs(occurredAt.getTime() - recordedAt.getTime()) < 60_000;

    // Entry header — type + timestamp line
    doc
      .fontSize(10)
      .font("Helvetica-Bold")
      .fillColor("#0ea5e9")
      .text(`[${e.entry_type.toUpperCase()}]`, { continued: true })
      .fillColor("#000")
      .font("Helvetica")
      .text(`  ${formatDateTime(occurredAt)}`);

    if (!sameTime) {
      doc
        .fontSize(8)
        .fillColor("#666")
        .text(`  (recorded ${formatDateTime(recordedAt)})`)
        .fillColor("#000");
    }

    // Position block
    if (e.position_lat !== null && e.position_lon !== null) {
      doc
        .fontSize(9)
        .font("Helvetica")
        .text(`  Position: ${formatPosition(e.position_lat, e.position_lon)}`);
    }

    // Notes block
    if (e.notes) {
      doc.fontSize(10).font("Helvetica").text(`  ${e.notes}`, {
        indent: 0,
        align: "left",
      });
    }

    // Conditions block (engine hours / wind / fuel — structured per type)
    if (e.conditions && Object.keys(e.conditions).length > 0) {
      const lines = formatConditions(e.entry_type, e.conditions);
      for (const line of lines) {
        doc.fontSize(9).fillColor("#444").text(`  ${line}`).fillColor("#000");
      }
    }

    // Recorded-by line
    if (e.recorded_by) {
      doc
        .fontSize(8)
        .fillColor("#666")
        .text(`  Recorded by: ${e.recorded_by}`)
        .fillColor("#000");
    }

    doc.moveDown(0.5);
  }

  private writeFooter(doc: PDFKit.PDFDocument, input: LogbookPdfInput): void {
    doc.moveDown(1);
    doc.moveTo(54, doc.y).lineTo(558, doc.y).strokeColor("#ddd").stroke();
    doc.moveDown(0.5);
    doc
      .fontSize(8)
      .fillColor("#666")
      .font("Helvetica-Oblique")
      .text(
        `${input.entries.length} entr${input.entries.length === 1 ? "y" : "ies"} · ` +
          `Generated ${input.generatedAt.toUTCString()} by Helmwise (helmwise.co). ` +
          `This is a non-binding extract of the vessel's electronic logbook.`,
        { align: "center" },
      );
  }
}

function formatDateTime(d: Date): string {
  // ISO-ish without seconds, UTC label — terse and unambiguous for SAR review.
  const iso = d.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

function formatPosition(lat: number, lon: number): string {
  // Degrees / decimal-minutes — the convention most maritime references use
  // (37° 48.5' N / 122° 24.3' W). DMS is too verbose for a logbook line.
  const latH = lat >= 0 ? "N" : "S";
  const lonH = lon >= 0 ? "E" : "W";
  const aLat = Math.abs(lat);
  const aLon = Math.abs(lon);
  const latDeg = Math.floor(aLat);
  const lonDeg = Math.floor(aLon);
  const latMin = (aLat - latDeg) * 60;
  const lonMin = (aLon - lonDeg) * 60;
  return `${latDeg}° ${latMin.toFixed(1)}' ${latH} / ${lonDeg}° ${lonMin.toFixed(1)}' ${lonH}`;
}

function formatConditions(
  entryType: string,
  conditions: Record<string, unknown>,
): string[] {
  const out: string[] = [];
  const pick = (key: string, label?: string): void => {
    const v = conditions[key];
    if (v === undefined || v === null || v === "") return;
    out.push(`${label ?? key}: ${String(v)}`);
  };

  switch (entryType) {
    case "engine":
      pick("engine_hours", "Engine hours");
      pick("rpm", "RPM");
      pick("oil_pressure", "Oil pressure");
      pick("coolant_temp", "Coolant temp");
      pick("action", "Action");
      break;
    case "fuel":
      pick("fuel_pct", "Fuel %");
      pick("fuel_litres", "Fuel litres");
      pick("water_pct", "Water %");
      break;
    case "weather":
      pick("wind_kt", "Wind");
      pick("wind_dir", "Wind dir");
      pick("waves_m", "Waves (m)");
      pick("visibility_nm", "Visibility (nm)");
      pick("pressure_hpa", "Pressure (hPa)");
      pick("cloud", "Cloud");
      break;
    case "watch_handover":
      pick("from", "From");
      pick("to", "To");
      pick("course", "Course");
      pick("speed_kt", "Speed (kt)");
      break;
    case "departure":
    case "arrival":
      pick("vessel", "Vessel");
      pick("eta", "ETA");
      pick("distance_nm", "Distance (nm)");
      break;
    case "position":
      pick("course", "Course");
      pick("speed_kt", "Speed (kt)");
      break;
    case "event":
    case "note":
    default:
      // Generic key/value rendering for unknown types
      for (const k of Object.keys(conditions)) pick(k);
      break;
  }
  return out;
}
