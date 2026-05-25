import PDFDocument from "pdfkit";

export interface FloatPlanSender {
  name: string;
  email: string;
  phone?: string | null;
}

export interface FloatPlanVessel {
  name?: string;
  type?: string;
  length_ft?: number;
  color?: string;
  registration?: string;
  hailing_port?: string;
  distinguishing_features?: string;
  // Sat-comm / safety identifiers
  mmsi?: string;
  epirb?: string;
  inreach_id?: string;
}

export interface FloatPlanWaypoint {
  name?: string;
  lat?: number;
  lon?: number;
  eta?: string;
}

export interface FloatPlanPassage {
  name?: string;
  departure_port?: string;
  destination_port?: string;
  departure_time?: string;
  eta?: string;
  distance_nm?: number;
  waypoints?: FloatPlanWaypoint[];
  weather_summary?: string;
  notes?: string;
}

export interface FloatPlanCrew {
  name: string;
  age?: number;
  role?: string;
  medical_notes?: string;
}

export interface FloatPlanRecipient {
  name: string;
  email: string;
  relationship?: string | null;
  phone?: string | null;
}

export interface FloatPlanInput {
  sender: FloatPlanSender;
  vessel: FloatPlanVessel;
  passage: FloatPlanPassage;
  crew?: FloatPlanCrew[];
  recipients: FloatPlanRecipient[];
  generatedAt: Date;
}

// Renders a two-page float plan PDF to a Buffer. Layout intentionally plain:
// in an emergency the recipient may be reading this on a low-res screen, may
// be panicked, and may forward it to a SAR coordinator who has never heard of
// Helmwise. Information first, branding second.
export class FloatPlanPdfService {
  async render(input: FloatPlanInput): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: "LETTER",
        margins: { top: 54, bottom: 54, left: 54, right: 54 },
        info: {
          Title: `Float Plan — ${input.vessel.name ?? "Vessel"}`,
          Author: "Helmwise",
          Subject: "Maritime float plan",
        },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      this.writePage1(doc, input);
      doc.addPage();
      this.writePage2(doc, input);
      doc.end();
    });
  }

  private writePage1(doc: PDFKit.PDFDocument, input: FloatPlanInput): void {
    const { sender, vessel, passage, crew } = input;

    // Header
    doc
      .fontSize(20)
      .font("Helvetica-Bold")
      .text("FLOAT PLAN", { align: "left" });
    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor("#666")
      .text(`Generated ${input.generatedAt.toUTCString()} via Helmwise`, {
        align: "left",
      });
    doc.fillColor("#000");
    doc.moveDown(0.5);

    // Sender / preparer
    this.heading(doc, "Prepared by");
    this.kv(doc, "Name", sender.name);
    this.kv(doc, "Email", sender.email);
    if (sender.phone) this.kv(doc, "Phone", sender.phone);
    doc.moveDown(0.5);

    // Vessel block
    this.heading(doc, "Vessel");
    this.kv(doc, "Name", vessel.name ?? "—");
    if (vessel.type) this.kv(doc, "Type", vessel.type);
    if (vessel.length_ft !== undefined)
      this.kv(doc, "Length", `${vessel.length_ft} ft`);
    if (vessel.color) this.kv(doc, "Hull color", vessel.color);
    if (vessel.registration) this.kv(doc, "Registration", vessel.registration);
    if (vessel.hailing_port) this.kv(doc, "Hailing port", vessel.hailing_port);
    if (vessel.distinguishing_features)
      this.kv(doc, "Distinguishing features", vessel.distinguishing_features);
    if (vessel.mmsi) this.kv(doc, "MMSI", vessel.mmsi);
    if (vessel.epirb) this.kv(doc, "EPIRB", vessel.epirb);
    if (vessel.inreach_id) this.kv(doc, "InReach ID", vessel.inreach_id);
    doc.moveDown(0.5);

    // Passage block
    this.heading(doc, "Passage");
    this.kv(doc, "Departure", passage.departure_port ?? "—");
    this.kv(doc, "Departure time", passage.departure_time ?? "—");
    this.kv(doc, "Destination", passage.destination_port ?? "—");
    this.kv(doc, "ETA", passage.eta ?? "—");
    if (passage.distance_nm !== undefined)
      this.kv(doc, "Distance", `${passage.distance_nm.toFixed(1)} nm`);
    doc.moveDown(0.5);

    // Waypoints
    if (passage.waypoints && passage.waypoints.length > 0) {
      this.heading(doc, "Route waypoints");
      doc.fontSize(10).font("Helvetica");
      passage.waypoints.forEach((wp, i) => {
        const coords =
          wp.lat !== undefined && wp.lon !== undefined
            ? ` (${wp.lat.toFixed(4)}, ${wp.lon.toFixed(4)})`
            : "";
        const eta = wp.eta ? ` — ETA ${wp.eta}` : "";
        doc.text(`  ${i + 1}. ${wp.name ?? "Waypoint"}${coords}${eta}`);
      });
      doc.moveDown(0.5);
    }

    // Weather summary
    if (passage.weather_summary) {
      this.heading(doc, "Weather summary at generation");
      doc.fontSize(10).font("Helvetica").text(passage.weather_summary);
      doc.moveDown(0.5);
    }

    // Crew
    if (crew && crew.length > 0) {
      this.heading(doc, `People on board (${crew.length})`);
      doc.fontSize(10).font("Helvetica");
      crew.forEach((c, i) => {
        const role = c.role ? ` — ${c.role}` : "";
        const age = c.age !== undefined ? `, age ${c.age}` : "";
        doc.text(`  ${i + 1}. ${c.name}${age}${role}`);
        if (c.medical_notes) {
          doc
            .fillColor("#666")
            .text(`     Medical: ${c.medical_notes}`)
            .fillColor("#000");
        }
      });
      doc.moveDown(0.5);
    }

    if (passage.notes) {
      this.heading(doc, "Additional notes");
      doc.fontSize(10).font("Helvetica").text(passage.notes);
    }
  }

  private writePage2(doc: PDFKit.PDFDocument, input: FloatPlanInput): void {
    const { vessel, passage, recipients } = input;

    doc.fontSize(16).font("Helvetica-Bold").text("If this vessel is overdue");
    doc.moveDown(0.5);

    // CRITICAL DISCLAIMER — this is the legal contract with the recipient.
    // Wording chosen so a non-mariner reading on a phone gets it immediately.
    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .fillColor("#a00")
      .text(
        "Helmwise does NOT automatically alert the Coast Guard or any rescue authority. " +
          "You — the recipient of this plan — are responsible for initiating a search if " +
          `${vessel.name ?? "the vessel"} is overdue. Please act on the steps below.`,
      )
      .fillColor("#000");
    doc.moveDown(0.75);

    this.heading(doc, "Step 1 — Try to contact the vessel");
    doc
      .fontSize(10)
      .font("Helvetica")
      .text(
        "If you have not heard from the vessel by the ETA above plus a reasonable buffer, " +
          "try the following channels in order:",
      );
    doc.text("  • SMS or phone call to the operator");
    if (vessel.inreach_id)
      doc.text(`  • Garmin InReach ID: ${vessel.inreach_id}`);
    if (vessel.mmsi)
      doc.text(`  • DSC call to MMSI ${vessel.mmsi} via VHF Channel 16`);
    if (vessel.epirb)
      doc.text(
        `  • If you receive an EPIRB alert: that beacon is ${vessel.epirb}`,
      );
    doc.moveDown(0.5);

    this.heading(doc, "Step 2 — If still no contact after 1 hour past ETA");
    doc
      .fontSize(10)
      .font("Helvetica")
      .text(
        "Call the appropriate maritime authority for the vessel's location and provide them this plan:",
      );
    doc.text("  • In US waters: US Coast Guard — call 911 or VHF Channel 16");
    doc.text(
      "  • In UK waters: HM Coastguard — 999, ask for Coastguard, or VHF Channel 16",
    );
    doc.text(
      "  • In EU/Schengen waters: MRCC for the country (search 'MRCC <country>')",
    );
    doc.text(
      "  • Elsewhere: nearest harbour authority, port captain, or marina harbour master",
    );
    doc.moveDown(0.5);

    this.heading(doc, "Step 3 — Provide them with this float plan");
    doc
      .fontSize(10)
      .font("Helvetica")
      .text(
        "Read them the vessel description, route, and last-known position from page 1. " +
          "Mention the time of the last successful communication with the vessel.",
      );
    doc.moveDown(0.75);

    // Recipient roster
    this.heading(
      doc,
      `Other people who received this plan (${recipients.length})`,
    );
    doc.fontSize(10).font("Helvetica");
    recipients.forEach((r) => {
      const rel = r.relationship ? ` (${r.relationship})` : "";
      doc.text(`  • ${r.name}${rel} — ${r.email}`);
    });
    doc.moveDown(0.75);

    // Footer
    doc
      .fontSize(9)
      .fillColor("#666")
      .font("Helvetica-Oblique")
      .text(
        "This float plan was generated by Helmwise (helmwise.co) — a passage planning tool. " +
          "It is a planning document only and is not a substitute for a registered SAR service.",
        { align: "center" },
      );
  }

  private heading(doc: PDFKit.PDFDocument, text: string): void {
    doc.fontSize(12).font("Helvetica-Bold").fillColor("#000").text(text);
    doc.moveTo(54, doc.y).lineTo(558, doc.y).strokeColor("#ddd").stroke();
    doc.moveDown(0.25);
  }

  private kv(doc: PDFKit.PDFDocument, key: string, value: string): void {
    doc
      .fontSize(10)
      .font("Helvetica-Bold")
      .text(`${key}: `, { continued: true });
    doc.font("Helvetica").text(value);
  }
}
