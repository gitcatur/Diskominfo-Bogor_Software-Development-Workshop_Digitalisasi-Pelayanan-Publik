import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * EmailService - Handles email sending with Resend API
 */
export class EmailService {
  constructor() {
    this.from = process.env.RESEND_FROM || 'noreply@localhost';
    this.replyTo = process.env.RESEND_REPLY_TO || process.env.RESEND_FROM;
    
    // Debug configuration
    console.log('🔧 EmailService initialized with:');
    console.log('  - API Key:', process.env.RESEND_API_KEY ? '✅ Set' : '❌ Missing');
    console.log('  - From:', this.from);
    console.log('  - Reply-To:', this.replyTo);
  }

  /**
   * Send email with comprehensive error handling
   * @param {Object} options - Email options
   * @param {string|string[]} options.to - Recipient email(s)
   * @param {string} options.subject - Email subject
   * @param {string} options.html - HTML content
   * @param {string} options.text - Text fallback content
   * @param {string} [options.from] - Sender email (optional)
   * @param {string} [options.replyTo] - Reply-to email (optional)
   * @returns {Promise<Object>} - Response object with success status and data/error
   */
  async sendEmail({ to, subject, html, text, from, replyTo }) {
    try {
      // Validate required fields
      if (!to || !subject || (!html && !text)) {
        throw new Error('Missing required fields: to, subject, and (html or text)');
      }

      // Prepare email data
      const emailData = {
        from: from || this.from,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text,
        replyTo: replyTo || this.replyTo,
      };

      console.log(`📧 Sending email to: ${Array.isArray(to) ? to.join(', ') : to}`);
      console.log(`📧 Subject: ${subject}`);

      // Send email via Resend
      const response = await resend.emails.send(emailData);

      console.log('📧 Full Resend response:', JSON.stringify(response, null, 2));

      console.log('✅ Email sent successfully:', {
        id: response.data?.id || response.id,
        to: emailData.to,
        subject: emailData.subject,
        response: response
      });

      return {
        success: true,
        data: response.data || response,
        message: 'Email sent successfully',
      };

    } catch (error) {
      console.error('❌ Email sending failed:', error);

      // Handle specific Resend API errors
      const errorResponse = this.handleResendError(error);
      
      return {
        success: false,
        error: errorResponse,
        message: errorResponse.message,
      };
    }
  }

  /**
   * Handle Resend API specific errors
   * @param {Error} error - The caught error
   * @returns {Object} - Formatted error response
   */
  handleResendError(error) {
    const statusCode = error?.response?.status || error?.status || 500;
    const errorMessage = error?.message || 'Unknown error occurred';

    switch (statusCode) {
      case 401:
        return {
          code: 'UNAUTHORIZED',
          message: 'Invalid API key. Please check RESEND_API_KEY in your environment variables.',
          statusCode: 401,
          retryable: false,
        };

      case 422:
        return {
          code: 'UNPROCESSABLE_ENTITY',
          message: 'Domain not verified. Please verify your domain in Resend dashboard.',
          statusCode: 422,
          retryable: false,
        };

      case 429:
        return {
          code: 'RATE_LIMITED',
          message: 'Rate limit exceeded. Please retry after some time.',
          statusCode: 429,
          retryable: true,
          retryAfter: error?.response?.headers?.['retry-after'] || 60,
        };

      case 500:
      case 502:
      case 503:
      case 504:
        return {
          code: 'SERVER_ERROR',
          message: 'Resend service temporarily unavailable. Please retry later.',
          statusCode,
          retryable: true,
        };

      default:
        return {
          code: 'UNKNOWN_ERROR',
          message: errorMessage,
          statusCode,
          retryable: statusCode >= 500,
        };
    }
  }

  /**
   * Send email with retry logic for transient errors
   * @param {Object} options - Email options
   * @param {number} maxRetries - Maximum number of retries (default: 3)
   * @param {number} retryDelay - Delay between retries in ms (default: 1000)
   * @returns {Promise<Object>} - Response object
   */
  async sendEmailWithRetry(options, maxRetries = 3, retryDelay = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await this.sendEmail(options);
      
      if (result.success) {
        if (attempt > 1) {
          console.log(`✅ Email sent successfully on attempt ${attempt}`);
        }
        return result;
      }

      lastError = result.error;
      
      // Don't retry if error is not retryable
      if (!result.error?.retryable) {
        console.log(`❌ Non-retryable error on attempt ${attempt}:`, result.error?.message);
        break;
      }

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        console.log(`❌ Max retries (${maxRetries}) exceeded`);
        break;
      }

      const delay = result.error?.retryAfter ? 
        result.error.retryAfter * 1000 : 
        retryDelay * Math.pow(2, attempt - 1); // Exponential backoff

      console.log(`⏳ Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    return {
      success: false,
      error: lastError,
      message: `Failed after ${maxRetries} attempts: ${lastError?.message}`,
    };
  }
}

// Export singleton instance
export const emailService = new EmailService();
