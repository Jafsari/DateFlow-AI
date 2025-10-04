# Email Setup Guide for AI Dating Assistant

## Current Status
✅ **Email verification is working with a manual verification system for development**

The app currently uses a manual email verification endpoint that allows you to verify emails without needing to configure SMTP settings.

## How to Use Email Verification Now

1. **Sign up** with the enhanced signup form
2. **Redirected** to the email verification page automatically
3. **Enter your email** and click "Verify Email"
4. **Login** with your verified account

## To Enable Real Email Sending (Optional)

If you want to send actual emails, follow these steps:

### Option 1: Gmail Setup (Recommended for Development)

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate an App Password**:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a password for "Mail"
3. **Update your `.env` file**:
   ```env
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-16-character-app-password
   FRONTEND_URL=http://localhost:3000
   ```

### Option 2: Other Email Services

Update the email service configuration in `dating-agent-backend/services/emailService.js`:

```javascript
const transporter = nodemailer.createTransport({
  service: 'your-service', // e.g., 'outlook', 'yahoo', 'hotmail'
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});
```

### Option 3: Custom SMTP

```javascript
const transporter = nodemailer.createTransport({
  host: 'your-smtp-host',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});
```

## Current Features

✅ **Manual Email Verification** - Works without SMTP configuration  
✅ **Beautiful Email Templates** - Ready when SMTP is configured  
✅ **Email Expiration** - 24-hour token expiration  
✅ **Resend Functionality** - Users can request new verification emails  
✅ **Welcome Emails** - Sent after successful verification  

## Testing the System

1. **Start the backend**: `cd dating-agent-backend && npm run dev`
2. **Start the frontend**: `cd dating-agent-frontend && npm start`
3. **Visit**: `http://localhost:3000`
4. **Sign up** with the enhanced form
5. **Verify email** using the manual verification page
6. **Login** and access the AI chat

## Troubleshooting

### "Username and Password not accepted" Error
- Make sure you're using an App Password (not your regular password) for Gmail
- Ensure 2-Factor Authentication is enabled
- Check that the email and password are correct in `.env`

### Manual Verification Not Working
- Check that the backend is running on port 5001
- Verify the MongoDB connection is working
- Check the browser console for any errors

## Next Steps

The system is fully functional with manual verification. To enable real emails:

1. Choose an email service (Gmail recommended)
2. Follow the setup instructions above
3. Update your `.env` file
4. Restart the backend server

The beautiful email templates are already created and ready to use once SMTP is configured! 🎉
