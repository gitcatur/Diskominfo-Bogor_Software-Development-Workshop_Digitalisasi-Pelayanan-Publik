import { NextResponse } from "next/server";
import {
  Submission,
  NotificationLog,
  initializeDatabase,
} from "@/lib/sequelize";
import { sendStatusUpdateNotification } from "@/lib/notify/sicuba";
import { emailService } from "@/lib/email";
import { emailTemplates } from "@/lib/email-templates";

// Initialize database on first request
let dbInitialized = false;
const initDB = async () => {
  if (!dbInitialized) {
    await initializeDatabase();
    dbInitialized = true;
  }
};

// Status progression validation
const validateStatusProgression = (currentStatus, newStatus) => {
  // Define allowed status transitions
  const allowedTransitions = {
    "PENGAJUAN_BARU": ["DIPROSES", "DITOLAK"],
    "DIPROSES": ["SELESAI", "DITOLAK"],
    "SELESAI": [], // Final status - no further changes allowed
    "DITOLAK": [] // Final status - no further changes allowed
  };

  // Check if transition is allowed
  const allowedNextStatuses = allowedTransitions[currentStatus] || [];

  if (!allowedNextStatuses.includes(newStatus)) {
    return {
      isValid: false,
      message: `Status tidak dapat diubah dari "${currentStatus}" ke "${newStatus}". ` +
               `Status hanya dapat maju: PENGAJUAN_BARU → DIPROSES → SELESAI. ` +
               `Status yang diizinkan: ${allowedNextStatuses.length > 0 ? allowedNextStatuses.join(", ") : "tidak ada (status final)"}`
    };
  }

  return {
    isValid: true,
    message: "Status transition valid"
  };
};

// Handle CORS preflight
export async function OPTIONS() {
  console.log("🔍 OPTIONS request received for status update");
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

// Handle PATCH - Update submission status
export async function PATCH(request, { params }) {
  console.log("🔍 PATCH request received for status update");
  console.log("🔍 Request method:", request.method);
  console.log("🔍 Request URL:", request.url);
  console.log("🔍 Params:", params);

  try {
    await initDB();

    const { id } = params;
    const body = await request.json();
    const { status } = body;

    console.log("Updating submission:", id, "to status:", status);

    // Validation
    if (
      !status ||
      !["PENGAJUAN_BARU", "DIPROSES", "SELESAI", "DITOLAK"].includes(status)
    ) {
      return NextResponse.json(
        { message: "Status tidak valid" },
        { status: 400 }
      );
    }

    // Find submission
    const submission = await Submission.findByPk(id);
    if (!submission) {
      return NextResponse.json(
        { message: "Pengajuan tidak ditemukan" },
        { status: 404 }
      );
    }

    // Check if status is actually changing
    if (submission.status === status) {
      return NextResponse.json(
        { message: "Status sudah sama" },
        { status: 400 }
      );
    }

    // Validate status progression
    const validation = validateStatusProgression(submission.status, status);
    if (!validation.isValid) {
      console.log("❌ Invalid status transition:", submission.status, "->", status);
      return NextResponse.json(
        {
          message: validation.message,
          current_status: submission.status,
          attempted_status: status
        },
        { status: 400 }
      );
    }

    console.log("✅ Valid status transition:", submission.status, "->", status);

    // Update status
    const oldStatus = submission.status;
    await submission.update({ status });

    console.log("Status updated successfully:", oldStatus, "->", status);

    // Send notifications
    const notificationPromises = [];

    // Send WhatsApp notification
    const waResult = await sendStatusUpdateNotification(submission, status);
    notificationPromises.push(
      NotificationLog.create({
        submission_id: submission.id,
        channel: "WHATSAPP",
        send_status: waResult.success ? "SUCCESS" : "FAILED",
        payload: {
          to: submission.no_wa,
          status: status,
          result: waResult,
        },
      })
    );

    // Send email notification if email exists
    console.log(
      "📧 Checking email notification for submission:",
      submission.id
    );
    console.log("📧 Submission email:", submission.email);

    if (submission.email) {
      console.log("📧 Sending email notification to:", submission.email);
      
      // Use new email service with template
      const emailTemplate = emailTemplates.statusUpdate({
        name: submission.nama,
        email: submission.email,
        serviceType: submission.jenis_layanan,
        trackingCode: submission.tracking_code,
        status: status,
        updatedAt: new Date().toISOString(),
        notes: `Status pengajuan Anda telah diubah dari ${oldStatus} menjadi ${status}`,
      });

      const emailResult = await emailService.sendEmail({
        to: submission.email,
        subject: "Update Status Pengajuan",
        html: emailTemplate.html,
        text: emailTemplate.text,
      });
      
      console.log("📧 Email result:", emailResult);

      notificationPromises.push(
        NotificationLog.create({
          submission_id: submission.id,
          channel: "EMAIL",
          send_status: emailResult.success ? "SUCCESS" : "FAILED",
          payload: {
            to: submission.email,
            status: status,
            result: emailResult,
          },
        })
      );
    } else {
      console.log("📧 No email address found for submission:", submission.id);
    }

    // Wait for all notification logs to be created
    await Promise.all(notificationPromises);

    console.log("All notifications processed successfully");

    return NextResponse.json({
      message: "Status berhasil diupdate",
      old_status: oldStatus,
      new_status: status,
      submission_id: submission.id,
    });
  } catch (error) {
    console.error("Error updating submission status:", error);

    return NextResponse.json(
      {
        message: "Terjadi kesalahan internal server",
        error: error.message,
      },
      { status: 500 }
    );
  }
}

// Handle GET - Not allowed
export async function GET() {
  console.log("🔍 GET request received for status update");
  return NextResponse.json(
    {
      message: "Method GET not allowed. Use PATCH to update status.",
      allowed_methods: ["PATCH", "OPTIONS"],
    },
    { status: 405 }
  );
}

// Handle POST - Not allowed
export async function POST() {
  console.log("🔍 POST request received for status update");
  return NextResponse.json(
    {
      message: "Method POST not allowed. Use PATCH to update status.",
      allowed_methods: ["PATCH", "OPTIONS"],
    },
    { status: 405 }
  );
}

// Handle PUT - Not allowed
export async function PUT() {
  console.log("🔍 PUT request received for status update");
  return NextResponse.json(
    {
      message: "Method PUT not allowed. Use PATCH to update status.",
      allowed_methods: ["PATCH", "OPTIONS"],
    },
    { status: 405 }
  );
}

// Handle DELETE - Not allowed
export async function DELETE() {
  console.log("🔍 DELETE request received for status update");
  return NextResponse.json(
    {
      message: "Method DELETE not allowed. Use PATCH to update status.",
      allowed_methods: ["PATCH", "OPTIONS"],
    },
    { status: 405 }
  );
}
