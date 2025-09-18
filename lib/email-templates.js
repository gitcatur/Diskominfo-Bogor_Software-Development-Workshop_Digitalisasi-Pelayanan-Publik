/**
 * Email Templates for Layanan Publik Mobile
 */

/**
 * Generate HTML email template
 * @param {Object} options - Template options
 * @param {string} options.title - Email title
 * @param {string} options.content - Main content HTML
 * @param {string} options.actionText - Call-to-action button text
 * @param {string} options.actionUrl - Call-to-action button URL
 * @param {string} options.footerText - Footer text
 * @returns {string} - Complete HTML email
 */
export function generateEmailHTML({
  title = 'Layanan Publik Mobile',
  content = '',
  actionText = '',
  actionUrl = '',
  footerText = 'Terima kasih telah menggunakan Layanan Publik Mobile.'
}) {
  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f8fafc;
    }
    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%);
      color: white;
      padding: 30px 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 700;
    }
    .header p {
      margin: 8px 0 0 0;
      opacity: 0.9;
      font-size: 14px;
    }
    .content {
      padding: 30px 20px;
    }
    .content h2 {
      color: #1f2937;
      margin: 0 0 20px 0;
      font-size: 20px;
    }
    .content p {
      margin: 0 0 16px 0;
      color: #4b5563;
    }
    .action-button {
      display: inline-block;
      background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%);
      color: white;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-weight: 600;
      margin: 20px 0;
      text-align: center;
    }
    .action-button:hover {
      background: linear-gradient(135deg, #1d4ed8 0%, #3730a3 100%);
    }
    .footer {
      background: #f9fafb;
      padding: 20px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
    }
    .footer p {
      margin: 0;
      color: #6b7280;
      font-size: 14px;
    }
    .info-box {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 16px;
      margin: 20px 0;
    }
    .info-box p {
      margin: 0;
      color: #1e40af;
      font-size: 14px;
    }
    .tracking-code {
      background: #f3f4f6;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      padding: 12px;
      font-family: 'Courier New', monospace;
      font-size: 16px;
      font-weight: 600;
      text-align: center;
      margin: 16px 0;
      color: #374151;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Layanan Publik Mobile</h1>
      <p>Sistem Layanan Publik Digital</p>
    </div>
    
    <div class="content">
      <h2>${title}</h2>
      ${content}
      
      ${actionText && actionUrl ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${actionUrl}" class="action-button">${actionText}</a>
        </div>
      ` : ''}
    </div>
    
    <div class="footer">
      <p>${footerText}</p>
      <p>© 2024 Layanan Publik Mobile. Workshop-Friendly System.</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generate text email template
 * @param {Object} options - Template options
 * @param {string} options.title - Email title
 * @param {string} options.content - Main content text
 * @param {string} options.actionText - Call-to-action text
 * @param {string} options.actionUrl - Call-to-action URL
 * @param {string} options.footerText - Footer text
 * @returns {string} - Complete text email
 */
export function generateEmailText({
  title = 'Layanan Publik Mobile',
  content = '',
  actionText = '',
  actionUrl = '',
  footerText = 'Terima kasih telah menggunakan Layanan Publik Mobile.'
}) {
  return `
${title}
================================

${content}

${actionText && actionUrl ? `
${actionText}: ${actionUrl}
` : ''}

---
${footerText}

© 2024 Layanan Publik Mobile. Workshop-Friendly System.
`;
}

/**
 * Predefined email templates
 */
export const emailTemplates = {
  /**
   * Submission confirmation template
   */
  submissionConfirmation: (data) => ({
    html: generateEmailHTML({
      title: 'Konfirmasi Pengajuan Layanan',
      content: `
        <p>Halo <strong>${data.name}</strong>,</p>
        <p>Terima kasih telah mengajukan layanan melalui sistem Layanan Publik Mobile. Pengajuan Anda telah berhasil diterima dan sedang dalam proses verifikasi.</p>
        
        <div class="info-box">
          <p><strong>Detail Pengajuan:</strong></p>
          <p>• Nama: ${data.name}</p>
          <p>• Email: ${data.email}</p>
          <p>• Jenis Layanan: ${data.serviceType}</p>
          <p>• Tanggal Pengajuan: ${new Date(data.submittedAt).toLocaleDateString('id-ID')}</p>
        </div>
        
        <div class="tracking-code">
          Kode Pelacakan: ${data.trackingCode}
        </div>
        
        <p>Gunakan kode pelacakan di atas untuk memantau status pengajuan Anda. Tim kami akan memproses pengajuan Anda dalam 1-3 hari kerja.</p>
      `,
      actionText: 'Cek Status Pengajuan',
      actionUrl: `${process.env.APP_BASE_URL || 'http://localhost:3000'}/public?tracking=${data.trackingCode}`,
      footerText: 'Jika Anda memiliki pertanyaan, silakan hubungi tim support kami.'
    }),
    text: (data) => generateEmailText({
      title: 'Konfirmasi Pengajuan Layanan',
      content: `
Halo ${data.name},

Terima kasih telah mengajukan layanan melalui sistem Layanan Publik Mobile. Pengajuan Anda telah berhasil diterima dan sedang dalam proses verifikasi.

Detail Pengajuan:
• Nama: ${data.name}
• Email: ${data.email}
• Jenis Layanan: ${data.serviceType}
• Tanggal Pengajuan: ${new Date(data.submittedAt).toLocaleDateString('id-ID')}

Kode Pelacakan: ${data.trackingCode}

Gunakan kode pelacakan di atas untuk memantau status pengajuan Anda. Tim kami akan memproses pengajuan Anda dalam 1-3 hari kerja.
      `,
      actionText: 'Cek Status Pengajuan',
      actionUrl: `${process.env.APP_BASE_URL || 'http://localhost:3000'}/public?tracking=${data.trackingCode}`,
      footerText: 'Jika Anda memiliki pertanyaan, silakan hubungi tim support kami.'
    })
  }),

  /**
   * Status update template
   */
  statusUpdate: (data) => ({
    html: generateEmailHTML({
      title: 'Update Status Pengajuan',
      content: `
        <p>Halo <strong>${data.name}</strong>,</p>
        <p>Status pengajuan Anda telah diperbarui. Berikut adalah informasi terbaru:</p>
        
        <div class="info-box">
          <p><strong>Status Terbaru:</strong> <span style="color: ${getStatusColor(data.status)}; font-weight: 600;">${getStatusText(data.status)}</span></p>
          <p><strong>Kode Pelacakan:</strong> ${data.trackingCode}</p>
          <p><strong>Jenis Layanan:</strong> ${data.serviceType}</p>
          <p><strong>Diperbarui pada:</strong> ${new Date(data.updatedAt).toLocaleString('id-ID')}</p>
        </div>
        
        ${data.notes ? `
          <div class="info-box">
            <p><strong>Catatan:</strong></p>
            <p>${data.notes}</p>
          </div>
        ` : ''}
        
        <p>Anda dapat memantau status pengajuan Anda kapan saja menggunakan kode pelacakan di atas.</p>
      `,
      actionText: 'Lihat Detail Lengkap',
      actionUrl: `${process.env.APP_BASE_URL || 'http://localhost:3000'}/public?tracking=${data.trackingCode}`,
      footerText: 'Terima kasih atas kesabaran Anda dalam menunggu proses pengajuan.'
    }),
    text: (data) => generateEmailText({
      title: 'Update Status Pengajuan',
      content: `
Halo ${data.name},

Status pengajuan Anda telah diperbarui. Berikut adalah informasi terbaru:

Status Terbaru: ${getStatusText(data.status)}
Kode Pelacakan: ${data.trackingCode}
Jenis Layanan: ${data.serviceType}
Diperbarui pada: ${new Date(data.updatedAt).toLocaleString('id-ID')}

${data.notes ? `Catatan: ${data.notes}` : ''}

Anda dapat memantau status pengajuan Anda kapan saja menggunakan kode pelacakan di atas.
      `,
      actionText: 'Lihat Detail Lengkap',
      actionUrl: `${process.env.APP_BASE_URL || 'http://localhost:3000'}/public?tracking=${data.trackingCode}`,
      footerText: 'Terima kasih atas kesabaran Anda dalam menunggu proses pengajuan.'
    })
  }),

  /**
   * Test email template
   */
  testEmail: () => ({
    html: generateEmailHTML({
      title: 'Test Email - Layanan Publik Mobile',
      content: `
        <p>Ini adalah email test untuk memverifikasi integrasi Resend API.</p>
        <div class="info-box">
          <p><strong>✅ Email berhasil dikirim!</strong></p>
          <p>Timestamp: ${new Date().toLocaleString('id-ID')}</p>
          <p>Environment: ${process.env.NODE_ENV || 'development'}</p>
        </div>
        <p>Jika Anda menerima email ini, berarti konfigurasi Resend API sudah berfungsi dengan baik.</p>
      `,
      footerText: 'Email test dari sistem Layanan Publik Mobile.'
    }),
    text: generateEmailText({
      title: 'Test Email - Layanan Publik Mobile',
      content: `
Ini adalah email test untuk memverifikasi integrasi Resend API.

✅ Email berhasil dikirim!
Timestamp: ${new Date().toLocaleString('id-ID')}
Environment: ${process.env.NODE_ENV || 'development'}

Jika Anda menerima email ini, berarti konfigurasi Resend API sudah berfungsi dengan baik.
      `,
      footerText: 'Email test dari sistem Layanan Publik Mobile.'
    })
  })
};

/**
 * Helper function to get status color
 */
function getStatusColor(status) {
  const colors = {
    'pending': '#f59e0b',
    'processing': '#3b82f6',
    'approved': '#10b981',
    'rejected': '#ef4444',
    'completed': '#8b5cf6'
  };
  return colors[status] || '#6b7280';
}

/**
 * Helper function to get status text
 */
function getStatusText(status) {
  const texts = {
    'pending': 'Menunggu Verifikasi',
    'processing': 'Sedang Diproses',
    'approved': 'Disetujui',
    'rejected': 'Ditolak',
    'completed': 'Selesai'
  };
  return texts[status] || status;
}
