import nodemailer from 'nodemailer'

export async function sendTradeNotificationEmail(to, subject, message) {
  const user = process.env.EMAIL_USER
  const pass = process.env.EMAIL_PASS

  if (!user || !pass) {
    throw new Error('EMAIL_USER 或 EMAIL_PASS 未設定在環境變數中')
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  })

  const mailOptions = {
    from: user,
    to,
    subject,
    html: message,
  }

  const info = await transporter.sendMail(mailOptions)
  console.log('✅ Email sent:', info.response)
  return info
}

export async function sendVerificationEmail(to, verificationLink, userName) {
  const user = process.env.EMAIL_USER
  const pass = process.env.EMAIL_PASS

  if (!user || !pass) {
    throw new Error('EMAIL_USER or EMAIL_PASS not set in environment variables')
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  })

  const mailOptions = {
    from: user,
    to,
    subject: 'Verify Your Email - CPBL Fantasy',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .header h1 { color: white; margin: 0; font-size: 28px; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
            .button:hover { opacity: 0.9; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚾ CPBL Fantasy</h1>
            </div>
            <div class="content">
              <h2>Welcome, ${userName}! 👋</h2>
              <p>Thank you for registering with CPBL Fantasy. To complete your registration, please verify your email address by clicking the button below:</p>
              
              <div style="text-align: center;">
                <a href="${verificationLink}" class="button" style="color: #ffffff !important;">Verify Email Address</a>
              </div>
              
              <p>Or copy and paste this link into your browser:</p>
              <p style="background: white; padding: 10px; border-radius: 5px; word-break: break-all; font-size: 12px;">
                ${verificationLink}
              </p>
              
              <div class="warning">
                <strong>⚠️ Important:</strong> This verification link will expire in 24 hours. If you didn't create an account, please ignore this email.
              </div>
              
              <p>Once verified, you'll be able to:</p>
              <ul>
                <li>Create or join fantasy leagues</li>
                <li>Manage your team roster</li>
                <li>Trade players with other managers</li>
                <li>Track your team's performance</li>
              </ul>
              
              <p>If you have any questions, feel free to reply to this email.</p>
              
              <p>Best regards,<br><strong>CPBL Fantasy Team</strong></p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} CPBL Fantasy. All rights reserved.</p>
              <p>This is an automated email. Please do not reply directly to this message.</p>
            </div>
          </div>
        </body>
      </html>
    `,
  }

  const info = await transporter.sendMail(mailOptions)
  console.log('✅ Verification email sent:', info.response)
  return info
}
