const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { generateVerificationToken, sendVerificationEmail, sendWelcomeEmail } = require('../services/emailService');
const router = express.Router();

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, location, city, neighborhood, travel_radius } = req.body;

    // Validation
    if (!email || !password || !name || !city || !neighborhood) {
      return res.status(400).json({
        error: 'Email, password, name, city, and neighborhood are required',
        code: 'MISSING_FIELDS'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters',
        code: 'PASSWORD_TOO_SHORT'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        error: 'User with this email already exists',
        code: 'USER_EXISTS'
      });
    }

    // Generate verification token
    const verificationToken = generateVerificationToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create new user
    const user = new User({
      email,
      password_hash: password, // Will be hashed by pre-save middleware
      profile: {
        name,
        location: location || city || '',
        city: city,
        neighborhood: neighborhood,
        travel_radius: travel_radius || 3
      },
      email_verification_token: verificationToken,
      email_verification_expires: verificationExpires
    });

    await user.save();
    console.log(`✅ New user registered: ${email}`);

    // Send verification email
    const emailSent = await sendVerificationEmail(email, name, verificationToken);
    if (!emailSent) {
      console.log(`⚠️ User registered but verification email failed to send to ${email}`);
    }

    res.status(201).json({
      message: 'User registered successfully. Please check your email to verify your account.',
      email_verification_sent: emailSent,
      user: {
        id: user._id,
        email: user.email,
        profile: user.profile,
        email_verified: user.email_verified
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      code: 'REGISTRATION_ERROR'
    });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required',
        code: 'MISSING_CREDENTIALS'
      });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Check if email is verified
    if (!user.email_verified) {
      return res.status(401).json({
        error: 'Please verify your email address before logging in',
        code: 'EMAIL_NOT_VERIFIED'
      });
    }

    // Update last active
    await user.updateLastActive();
    console.log(`✅ User logged in: ${email}`);

    // Generate JWT token with longer expiration
    const token = jwt.sign(
      { 
        userId: user._id, 
        email: user.email 
      },
      process.env.JWT_SECRET || 'fallback-secret-key-for-development',
      { expiresIn: process.env.JWT_EXPIRES_IN || '30d' } // Extended to 30 days
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        profile: user.profile
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      code: 'LOGIN_ERROR'
    });
  }
});

// Manual email verification (for development/testing)
router.post('/verify-email-manual', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Email is required',
        code: 'MISSING_EMAIL'
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    if (user.email_verified) {
      return res.status(400).json({
        error: 'Email is already verified',
        code: 'ALREADY_VERIFIED'
      });
    }

    // Manually verify the email
    user.email_verified = true;
    user.email_verification_token = null;
    user.email_verification_expires = null;
    await user.save();

    console.log(`✅ Email manually verified for user: ${user.email}`);

    res.json({
      message: 'Email verified successfully! You can now log in.',
      user: {
        id: user._id,
        email: user.email,
        profile: user.profile,
        email_verified: user.email_verified
      }
    });

  } catch (error) {
    console.error('Manual email verification error:', error);
    res.status(500).json({
      error: 'Email verification failed',
      code: 'VERIFICATION_ERROR'
    });
  }
});

// Verify email token
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        error: 'Verification token is required',
        code: 'MISSING_TOKEN'
      });
    }

    // Find user with this token
    const user = await User.findOne({
      email_verification_token: token,
      email_verification_expires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({
        error: 'Invalid or expired verification token',
        code: 'INVALID_TOKEN'
      });
    }

    // Mark email as verified
    user.email_verified = true;
    user.email_verification_token = null;
    user.email_verification_expires = null;
    await user.save();

    console.log(`✅ Email verified for user: ${user.email}`);

    // Send welcome email
    await sendWelcomeEmail(user.email, user.profile.name);

    res.json({
      message: 'Email verified successfully! Welcome to AI Dating Assistant!',
      user: {
        id: user._id,
        email: user.email,
        profile: user.profile,
        email_verified: user.email_verified
      }
    });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      error: 'Email verification failed',
      code: 'VERIFICATION_ERROR'
    });
  }
});

// Resend verification email
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Email is required',
        code: 'MISSING_EMAIL'
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    if (user.email_verified) {
      return res.status(400).json({
        error: 'Email is already verified',
        code: 'ALREADY_VERIFIED'
      });
    }

    // Generate new verification token
    const verificationToken = generateVerificationToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    user.email_verification_token = verificationToken;
    user.email_verification_expires = verificationExpires;
    await user.save();

    // Send verification email
    const emailSent = await sendVerificationEmail(email, user.profile.name, verificationToken);

    res.json({
      message: emailSent ? 'Verification email sent successfully' : 'User found but email sending failed',
      email_sent: emailSent
    });

  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      error: 'Failed to resend verification email',
      code: 'RESEND_ERROR'
    });
  }
});

// Verify token (for frontend to check if user is still authenticated)
router.get('/verify', require('../middleware/auth').authenticateToken, (req, res) => {
  res.json({
    message: 'Token is valid',
    user: req.user
  });
});

module.exports = router;
