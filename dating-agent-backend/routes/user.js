const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const User = require('../models/User');
const router = express.Router();

// GET /api/user/profile - Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const user = await User.findById(userId).select('-password_hash');
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    console.log(`👤 Retrieved profile for user: ${user.email}`);

    res.json({
      user: {
        id: user._id,
        email: user.email,
        profile: user.profile,
        date_history: user.date_history,
        created_at: user.created_at,
        last_active: user.last_active
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      error: 'Failed to retrieve profile',
      code: 'GET_PROFILE_ERROR'
    });
  }
});

// PUT /api/user/profile - Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { 
      name, 
      location, 
      neighborhood,
      travel_radius,
      age, 
      interests, 
      budget, 
      bio, 
      relationship_status,
      preferences 
    } = req.body;

    const updateData = {};
    if (name !== undefined) updateData['profile.name'] = name;
    if (location !== undefined) updateData['profile.location'] = location;
    if (neighborhood !== undefined) updateData['profile.neighborhood'] = neighborhood;
    if (travel_radius !== undefined) updateData['profile.travel_radius'] = travel_radius;
    if (age !== undefined) updateData['profile.age'] = age;
    if (interests !== undefined) updateData['profile.interests'] = interests;
    if (budget !== undefined && budget !== '') updateData['profile.budget'] = budget;
    if (bio !== undefined) updateData['profile.bio'] = bio;
    if (relationship_status !== undefined && relationship_status !== '') updateData['profile.relationship_status'] = relationship_status;
    
    console.log('🔧 Backend: Profile update data:', updateData);
    if (preferences) {
      Object.keys(preferences).forEach(key => {
        updateData[`profile.preferences.${key}`] = preferences[key];
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password_hash');

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    console.log(`✏️ Updated profile for user: ${user.email}`);
    console.log('🔧 Backend: Saved profile data:', user.profile);

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        email: user.email,
        profile: user.profile
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      error: 'Failed to update profile',
      code: 'UPDATE_PROFILE_ERROR'
    });
  }
});

// POST /api/user/date-history - Add date to history
router.post('/date-history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { date_id, activity, location, date, rating, notes } = req.body;

    if (!activity || !location || !date) {
      return res.status(400).json({
        error: 'Activity, location, and date are required',
        code: 'MISSING_FIELDS'
      });
    }

    const dateEntry = {
      date_id: date_id || `date_${Date.now()}`,
      activity,
      location,
      date: new Date(date),
      rating: rating || null,
      notes: notes || ''
    };

    const user = await User.findByIdAndUpdate(
      userId,
      { $push: { date_history: dateEntry } },
      { new: true }
    ).select('-password_hash');

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    console.log(`📅 Added date to history for user: ${user.email}`);

    res.json({
      message: 'Date added to history successfully',
      date_entry: dateEntry,
      user: {
        id: user._id,
        date_history: user.date_history
      }
    });

  } catch (error) {
    console.error('Add date history error:', error);
    res.status(500).json({
      error: 'Failed to add date to history',
      code: 'ADD_DATE_HISTORY_ERROR'
    });
  }
});

// GET /api/user/date-history - Get user's date history
router.get('/date-history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 20, page = 1 } = req.query;

    const user = await User.findById(userId).select('date_history');
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Simple pagination for date history
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedHistory = user.date_history
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(startIndex, endIndex);

    console.log(`📅 Retrieved ${paginatedHistory.length} dates from history for user: ${userId}`);

    res.json({
      date_history: paginatedHistory,
      pagination: {
        total: user.date_history.length,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(user.date_history.length / limit)
      }
    });

  } catch (error) {
    console.error('Get date history error:', error);
    res.status(500).json({
      error: 'Failed to retrieve date history',
      code: 'GET_DATE_HISTORY_ERROR'
    });
  }
});

// DELETE /api/user/delete-account - Delete user account and all data
router.delete('/delete-account', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Delete user (this will also delete conversations due to cascade)
    const user = await User.findByIdAndDelete(userId);
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    console.log(`🗑️ Deleted account and all data for user: ${user.email}`);

    res.json({
      message: 'Account and all associated data deleted successfully'
    });

  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      error: 'Failed to delete account',
      code: 'DELETE_ACCOUNT_ERROR'
    });
  }
});

module.exports = router;
