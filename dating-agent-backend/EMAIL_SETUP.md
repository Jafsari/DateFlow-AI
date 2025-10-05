# 📧 DateFlow Email Invitation Setup

## Overview
The DateFlow email invitation system sends calendar invitations with your generated date plans directly to users' email and calendar apps using SendGrid.

## Features
- 📧 Beautiful HTML email with DateFlow details
- 📅 Automatic .ics calendar file attachment
- 🔔 15-minute reminder before the date
- 💕 Optional partner email invitation
- 📱 Works with any email provider (Gmail, Outlook, etc.)
- 🚀 **Professional delivery** - won't go to spam
- 💰 **Free tier** - 100 emails/day forever

## Setup Instructions

### 1. SendGrid Account Setup
1. Go to [SendGrid.com](https://sendgrid.com) and create a free account
2. Verify your account via email
3. Go to "Settings" → "API Keys"
4. Create a new API key with "Full Access" permissions
5. Copy the API key (you won't see it again!)

### 2. Environment Configuration
Add these environment variables to your `.env` file:

```bash
# SendGrid Configuration
SENDGRID_API_KEY=SG.your-api-key-here
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
```

### 3. Domain Verification (Optional but Recommended)
For production, verify your domain with SendGrid:
1. Go to "Settings" → "Sender Authentication"
2. Add your domain (e.g., `yourdomain.com`)
3. Add the required DNS records
4. This improves deliverability and removes the "via sendgrid.net" footer

### 4. Free Tier Limits
- **100 emails per day** (forever)
- **40,000 emails per month** for the first 30 days
- Perfect for MVP and small-scale usage

## How It Works

### User Flow
1. **Generate DateFlow** → User creates their perfect date plan
2. **Click "📧 Send Invitation"** → Email modal opens
3. **Fill Details** → Email, date, time, optional partner email
4. **Send** → Email sent with calendar attachment
5. **Auto-Import** → Gmail automatically adds to calendar

### Email Content
- **Subject**: "Your DateFlow: [Title]"
- **HTML Body**: Beautiful formatted timeline with all details
- **Calendar Attachment**: .ics file with event details
- **Reminder**: 15 minutes before the date

### Technical Details
- Uses `nodemailer` for email delivery
- Generates RFC-compliant .ics calendar files
- Includes all DateFlow timeline details
- Supports partner email invitations (CC)
- Error handling and user feedback

## Testing
1. Generate a DateFlow in the app
2. Click the "📧 Send Invitation" button
3. Fill in your email and preferred date/time
4. Check your email for the invitation
5. Verify the calendar event was created

## Troubleshooting

### Email Not Sending
- Check `SENDGRID_API_KEY` is correct and has proper permissions
- Verify SendGrid account is active and not suspended
- Check server logs for SendGrid error messages
- Ensure you haven't exceeded the daily email limit

### Calendar Not Importing
- Ensure .ics file attachment is present
- Check email client supports calendar imports
- Try opening .ics file manually

### Partner Not Receiving Email
- Verify partner email address is correct
- Check spam folder (SendGrid has good deliverability, but some emails may still go to spam)
- Ensure both user and partner emails are valid

### SendGrid Specific Issues
- **API Key Issues**: Ensure the key has "Full Access" permissions
- **Rate Limiting**: Free tier allows 100 emails/day
- **Domain Verification**: For production, verify your domain to improve deliverability
- **Bounce Handling**: SendGrid automatically handles bounces and unsubscribes

## Security Notes
- Never commit SendGrid API keys to git
- Use environment variables for all sensitive data
- SendGrid handles authentication automatically - no user passwords needed
- API keys can be regenerated if compromised
