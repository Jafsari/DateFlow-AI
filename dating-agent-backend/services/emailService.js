const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Create transporter (using Gmail for demo - in production use a proper email service)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASS || 'your-app-password'
  }
});

// Generate verification token
function generateVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Send verification email
async function sendVerificationEmail(email, name, token) {
  const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}`;
  
  const mailOptions = {
    from: `"AI Dating Assistant" <${process.env.EMAIL_USER || 'noreply@datingagent.com'}>`,
    to: email,
    subject: '🌸 Welcome to AI Dating Assistant - Verify Your Account',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          .container {
            background: white;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 2.5rem;
            margin-bottom: 10px;
          }
          h1 {
            color: #667eea;
            font-size: 1.8rem;
            margin: 0;
          }
          .emoji {
            font-size: 1.5rem;
            margin: 0 5px;
          }
          .button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 25px;
            font-weight: bold;
            margin: 20px 0;
            transition: transform 0.3s ease;
          }
          .button:hover {
            transform: translateY(-2px);
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 0.9rem;
            color: #666;
            text-align: center;
          }
          .hearts {
            text-align: center;
            margin: 20px 0;
            font-size: 1.2rem;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">💖</div>
            <h1>Welcome to AI Dating Assistant!</h1>
          </div>
          
          <p>Hi <strong>${name}</strong>! <span class="emoji">🌸</span></p>
          
          <p>Thank you for joining our amazing community! We're so excited to help you find love and create meaningful connections.</p>
          
          <div class="hearts">
            💕 ✨ 🌸 💖 ✨ 💕
          </div>
          
          <p>To get started, please verify your email address by clicking the button below:</p>
          
          <div style="text-align: center;">
            <a href="${verificationUrl}" class="button">
              🌟 Verify My Account 🌟
            </a>
          </div>
          
          <p><strong>What happens next?</strong></p>
          <ul>
            <li>✨ Click the verification button above</li>
            <li>🎯 Complete your dating profile</li>
            <li>🤖 Start chatting with our AI assistant</li>
            <li>💕 Find your perfect matches!</li>
          </ul>
          
          <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
          <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 8px; font-family: monospace;">
            ${verificationUrl}
          </p>
          
          <div class="footer">
            <p>This link will expire in 24 hours for security reasons.</p>
            <p>If you didn't create this account, you can safely ignore this email.</p>
            <br>
            <p>With love,<br>The AI Dating Assistant Team 💖</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Verification email sent to ${email}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send verification email to ${email}:`, error);
    return false;
  }
}

// Send welcome email after verification
async function sendWelcomeEmail(email, name) {
  const mailOptions = {
    from: `"AI Dating Assistant" <${process.env.EMAIL_USER || 'noreply@datingagent.com'}>`,
    to: email,
    subject: '🎉 Welcome to AI Dating Assistant - You\'re All Set!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          .container {
            background: white;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 3rem;
            margin-bottom: 10px;
          }
          h1 {
            color: #667eea;
            font-size: 2rem;
            margin: 0;
          }
          .celebration {
            text-align: center;
            font-size: 2rem;
            margin: 20px 0;
          }
          .button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 25px;
            font-weight: bold;
            margin: 20px 0;
            transition: transform 0.3s ease;
          }
          .button:hover {
            transform: translateY(-2px);
          }
          .feature {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 10px;
            margin: 10px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🎉</div>
            <h1>Welcome Aboard, ${name}!</h1>
          </div>
          
          <div class="celebration">
            🎊 ✨ 🎉 ✨ 🎊
          </div>
          
          <p>Congratulations! Your email has been verified and your account is now active. You're ready to start your amazing dating journey!</p>
          
          <div style="text-align: center;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/ai-chat" class="button">
              🚀 Start Chatting with AI Assistant
            </a>
          </div>
          
          <p><strong>Here's what you can do now:</strong></p>
          
          <div class="feature">
            <strong>🤖 AI Chat Assistant</strong><br>
            Get personalized dating advice and conversation tips
          </div>
          
          <div class="feature">
            <strong>💕 Date Planning</strong><br>
            Discover perfect date ideas based on your preferences
          </div>
          
          <div class="feature">
            <strong>📊 Smart Insights</strong><br>
            Learn from your dating patterns and improve your success
          </div>
          
          <p>We're here to support you every step of the way. If you have any questions, just reply to this email!</p>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
            <p>Happy Dating! 💖</p>
            <p><em>The AI Dating Assistant Team</em></p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Welcome email sent to ${email}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send welcome email to ${email}:`, error);
    return false;
  }
}

module.exports = {
  generateVerificationToken,
  sendVerificationEmail,
  sendWelcomeEmail
};
