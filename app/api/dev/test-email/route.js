import { NextResponse } from 'next/server';
import { emailService } from '@/lib/email';
import { emailTemplates } from '@/lib/email-templates';

/**
 * Dev-only test endpoint for email functionality
 * GET /api/dev/test-email?to=email@example.com
 */
export async function GET(request) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Test endpoint only available in development mode' 
      },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const to = searchParams.get('to');

    if (!to) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required parameter: to' 
        },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid email format' 
        },
        { status: 400 }
      );
    }

    console.log(`🧪 Testing email to: ${to}`);

    // Get test email template
    const testTemplate = emailTemplates.testEmail();
    
    // Send test email
    const result = await emailService.sendEmail({
      to,
      subject: 'Test Email - Layanan Publik Mobile',
      html: testTemplate.html,
      text: testTemplate.text,
    });

    if (result.success) {
      console.log('✅ Test email sent successfully:', result.data);
      
      return NextResponse.json({
        success: true,
        message: 'Test email sent successfully',
        data: {
          emailId: result.data?.id,
          to,
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV,
        }
      });
    } else {
      console.error('❌ Test email failed:', result.error);
      
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          message: result.message,
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('❌ Test email endpoint error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message,
          statusCode: 500,
        },
        message: 'Internal server error occurred while testing email',
      },
      { status: 500 }
    );
  }
}

/**
 * POST method for testing with custom data
 * POST /api/dev/test-email
 * Body: { to: "email@example.com", template: "submissionConfirmation", data: {...} }
 */
export async function POST(request) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Test endpoint only available in development mode' 
      },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { to, template = 'testEmail', data = {} } = body;

    if (!to) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required field: to' 
        },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid email format' 
        },
        { status: 400 }
      );
    }

    console.log(`🧪 Testing ${template} email to: ${to}`);

    // Get template
    let emailTemplate;
    if (template === 'submissionConfirmation') {
      emailTemplate = emailTemplates.submissionConfirmation(data);
    } else if (template === 'statusUpdate') {
      emailTemplate = emailTemplates.statusUpdate(data);
    } else {
      emailTemplate = emailTemplates.testEmail();
    }

    // Send email
    const result = await emailService.sendEmail({
      to,
      subject: emailTemplate.subject || 'Test Email - Layanan Publik Mobile',
      html: emailTemplate.html,
      text: emailTemplate.text,
    });

    if (result.success) {
      console.log(`✅ ${template} email sent successfully:`, result.data);
      
      return NextResponse.json({
        success: true,
        message: `${template} email sent successfully`,
        data: {
          emailId: result.data?.id,
          to,
          template,
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV,
        }
      });
    } else {
      console.error(`❌ ${template} email failed:`, result.error);
      
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          message: result.message,
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('❌ Test email POST endpoint error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message,
          statusCode: 500,
        },
        message: 'Internal server error occurred while testing email',
      },
      { status: 500 }
    );
  }
}
