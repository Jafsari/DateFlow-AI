const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const Partner = require('../models/Partner');
const User = require('../models/User');
const router = express.Router();

// GET /api/partner - Get active partner profile for current user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const partner = await Partner.findOne({ user_id: userId, is_active: true });
    
    if (!partner) {
      return res.status(404).json({
        error: 'No active partner profile found',
        code: 'PARTNER_NOT_FOUND'
      });
    }

    console.log(`💕 Retrieved partner profile for user: ${userId}`);

    res.json({
      partner: partner
    });

  } catch (error) {
    console.error('Get partner profile error:', error);
    res.status(500).json({
      error: 'Failed to retrieve partner profile',
      code: 'GET_PARTNER_ERROR'
    });
  }
});

// POST /api/partner - Create a new partner profile
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      name,
      age,
      location,
      bio,
      interests,
      keywords,
      dietaryRestrictions,
      budget,
      lifestyle,
      preferences,
      personality_traits,
      deal_breakers,
      must_haves
    } = req.body;

    // Validation
    if (!name) {
      return res.status(400).json({
        error: 'Partner name is required',
        code: 'MISSING_NAME'
      });
    }

    // Deactivate any existing active partners
    await Partner.updateMany(
      { user_id: userId, is_active: true },
      { $set: { is_active: false } }
    );

    // Create new partner profile
    const partner = new Partner({
      user_id: userId,
      name,
      age,
      location,
      bio,
      interests: interests || [],
      keywords,
      dietaryRestrictions,
      budget,
      lifestyle: lifestyle || {},
      preferences: preferences || {},
      personality_traits: personality_traits || {},
      deal_breakers: deal_breakers || [],
      must_haves: must_haves || [],
      is_active: true
    });

    await partner.save();
    console.log(`✅ Created partner profile: ${name} for user: ${userId}`);

    // Update user's active_partner reference
    await User.findByIdAndUpdate(userId, { active_partner: partner._id });
    console.log(`✅ Updated user's active_partner reference`);

    res.status(201).json({
      message: 'Partner profile created successfully',
      partner: partner
    });

  } catch (error) {
    console.error('Create partner profile error:', error);
    res.status(500).json({
      error: 'Failed to create partner profile',
      code: 'CREATE_PARTNER_ERROR'
    });
  }
});

// PUT /api/partner/:partnerId - Update existing partner profile
router.put('/:partnerId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { partnerId } = req.params;
    const {
      name,
      age,
      location,
      bio,
      interests,
      keywords,
      dietaryRestrictions,
      budget,
      lifestyle,
      preferences,
      personality_traits,
      deal_breakers,
      must_haves,
      is_active
    } = req.body;

    // Find partner and verify ownership
    const partner = await Partner.findOne({ _id: partnerId, user_id: userId });
    
    if (!partner) {
      return res.status(404).json({
        error: 'Partner profile not found or unauthorized',
        code: 'PARTNER_NOT_FOUND'
      });
    }

    // Update fields
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (age !== undefined) updateData.age = age;
    if (location !== undefined) updateData.location = location;
    if (bio !== undefined) updateData.bio = bio;
    if (interests !== undefined) updateData.interests = interests;
    if (keywords !== undefined) updateData.keywords = keywords;
    if (dietaryRestrictions !== undefined) updateData.dietaryRestrictions = dietaryRestrictions;
    if (budget !== undefined) updateData.budget = budget;
    if (lifestyle !== undefined) updateData.lifestyle = lifestyle;
    if (preferences !== undefined) updateData.preferences = preferences;
    if (personality_traits !== undefined) updateData.personality_traits = personality_traits;
    if (deal_breakers !== undefined) updateData.deal_breakers = deal_breakers;
    if (must_haves !== undefined) updateData.must_haves = must_haves;
    if (is_active !== undefined) updateData.is_active = is_active;

    const updatedPartner = await Partner.findByIdAndUpdate(
      partnerId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    console.log(`✅ Updated partner profile: ${updatedPartner.name}`);

    res.json({
      message: 'Partner profile updated successfully',
      partner: updatedPartner
    });

  } catch (error) {
    console.error('Update partner profile error:', error);
    res.status(500).json({
      error: 'Failed to update partner profile',
      code: 'UPDATE_PARTNER_ERROR'
    });
  }
});

// DELETE /api/partner/:partnerId - Delete partner profile
router.delete('/:partnerId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { partnerId } = req.params;

    // Find partner and verify ownership
    const partner = await Partner.findOne({ _id: partnerId, user_id: userId });
    
    if (!partner) {
      return res.status(404).json({
        error: 'Partner profile not found or unauthorized',
        code: 'PARTNER_NOT_FOUND'
      });
    }

    // Soft delete by setting is_active to false
    partner.is_active = false;
    await partner.save();

    // Clear user's active_partner reference if this was the active partner
    const user = await User.findById(userId);
    if (user.active_partner && user.active_partner.toString() === partnerId) {
      user.active_partner = null;
      await user.save();
      console.log(`✅ Cleared user's active_partner reference`);
    }

    console.log(`✅ Deactivated partner profile: ${partner.name}`);

    res.json({
      message: 'Partner profile deactivated successfully'
    });

  } catch (error) {
    console.error('Delete partner profile error:', error);
    res.status(500).json({
      error: 'Failed to delete partner profile',
      code: 'DELETE_PARTNER_ERROR'
    });
  }
});

// GET /api/partner/all - Get all partner profiles for current user (including inactive)
router.get('/all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const partners = await Partner.find({ user_id: userId }).sort({ created_at: -1 });

    console.log(`💕 Retrieved ${partners.length} partner profiles for user: ${userId}`);

    res.json({
      partners: partners,
      count: partners.length
    });

  } catch (error) {
    console.error('Get all partners error:', error);
    res.status(500).json({
      error: 'Failed to retrieve partner profiles',
      code: 'GET_PARTNERS_ERROR'
    });
  }
});

module.exports = router;

