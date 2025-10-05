# 🚀 Quick SendGrid Setup for DateFlow

## 5-Minute Setup

### Step 1: Create SendGrid Account
1. Go to [sendgrid.com](https://sendgrid.com)
2. Click "Start for Free"
3. Fill out the form and verify your email

### Step 2: Get API Key
1. Login to SendGrid dashboard
2. Go to **Settings** → **API Keys**
3. Click **Create API Key**
4. Name it "DateFlow AI"
5. Select **Full Access** permissions
6. Click **Create & View**
7. **Copy the API key** (you won't see it again!)

### Step 3: Verify Sender Identity (IMPORTANT!)
1. Go to **Settings** → **Sender Authentication**
2. Click **Verify a Single Sender**
3. Enter your email address (the one you used for SendGrid account)
4. Fill out the form with your details
5. Check your email and click the verification link
6. ✅ You'll see "Verified" next to your email

### Step 4: Add to Your Environment
Add this to your `.env` file:
```bash
SENDGRID_API_KEY=SG.your-actual-api-key-here
SENDGRID_FROM_EMAIL=your-verified-email@gmail.com
```

### Step 5: Test It!
1. Start your backend server
2. Generate a DateFlow
3. Click "📧 Send Invitation"
4. Check your email!

## ✅ That's It!

**Benefits of SendGrid:**
- ✅ **100 emails/day FREE** forever
- ✅ **Professional delivery** - won't go to spam
- ✅ **No user passwords needed**
- ✅ **Works for all users**
- ✅ **Easy to scale** when you grow

**Cost:** $0 for the first 100 emails/day!

## Need Help?
- Check the full setup guide: `EMAIL_SETUP.md`
- SendGrid docs: [sendgrid.com/docs](https://sendgrid.com/docs)
- Free tier limits: 100 emails/day, 40k emails/month (first 30 days)
