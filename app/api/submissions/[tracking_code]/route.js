import { NextResponse } from "next/server";
import { Submission, initializeDatabase } from "@/lib/sequelize";

// Initialize database on first request
let dbInitialized = false;
const initDB = async () => {
  if (!dbInitialized) {
    await initializeDatabase();
    dbInitialized = true;
  }
};

export async function GET(request, { params }) {
  try {
    await initDB();

    const { tracking_code } = params;
    const { searchParams } = new URL(request.url);
    const last4_nik = searchParams.get("last4_nik");

    // Validation
    if (!tracking_code || !tracking_code.trim()) {
      return NextResponse.json(
        { message: "Kode tracking wajib diisi" },
        { status: 400 }
      );
    }

    if (!last4_nik || last4_nik.length !== 4 || !/^\d+$/.test(last4_nik)) {
      return NextResponse.json(
        { message: "4 digit terakhir NIK wajib diisi dan harus berupa angka" },
        { status: 400 }
      );
    }

    // Find submission by tracking code
    const submission = await Submission.findOne({
      where: { tracking_code: tracking_code.trim() },
    });

    if (!submission) {
      return NextResponse.json(
        { message: "Pengajuan tidak ditemukan" },
        { status: 404 }
      );
    }

    // Verify last 4 digits of NIK
    const submissionLast4 = submission.nik.slice(-4);
    if (submissionLast4 !== last4_nik) {
      return NextResponse.json(
        { message: "4 digit terakhir NIK tidak sesuai" },
        { status: 403 }
      );
    }

    // Return submission data (excluding sensitive info)
    const submissionData = {
      id: submission.id,
      tracking_code: submission.tracking_code,
      nama: submission.nama,
      jenis_layanan: submission.jenis_layanan,
      status: submission.status,
      createdAt: submission.created_at,
      updatedAt: submission.updated_at,
    };

    return NextResponse.json(submissionData);
  } catch (error) {
    console.error("Error fetching submission:", error);

    return NextResponse.json(
      { message: "Terjadi kesalahan internal server" },
      { status: 500 }
    );
  }
}
