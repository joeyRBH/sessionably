// Server-side subscription verification API endpoint
// Verifies subscription status and feature access

const { initDatabase, executeQuery } = require('./utils/database-connection');

/**
 * Subscription Plans Configuration (matches client-side)
 */
const SUBSCRIPTION_PLANS = {
  essential: {
    id: 'essential',
    features: {
      aiClinicalNotes: false,
      integratedTelehealth: false
    }
  },
  professional: {
    id: 'professional',
    features: {
      aiClinicalNotes: 'addon',
      integratedTelehealth: 'addon'
    }
  },
  complete: {
    id: 'complete',
    features: {
      aiClinicalNotes: true,
      integratedTelehealth: true
    }
  }
};

/**
 * Main handler for subscription check endpoint
 */
async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { userId, featureId } = req.method === 'POST' ? req.body : req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    if (!featureId) {
      return res.status(400).json({
        success: false,
        error: 'Feature ID is required'
      });
    }

    // Get user's subscription from database
    const subscription = await getUserSubscription(userId);

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found',
        allowed: false
      });
    }

    // Check feature access
    const access = checkFeatureAccess(subscription, featureId);

    return res.status(200).json({
      success: true,
      ...access,
      subscription: {
        planId: subscription.subscription_plan_id,
        status: subscription.subscription_status,
        selectedAddon: subscription.selected_addon
      }
    });

  } catch (error) {
    console.error('Subscription check error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}

/**
 * Get user's subscription from database
 */
async function getUserSubscription(userId) {
  try {
    await initDatabase();

    const result = await executeQuery(
      `SELECT
        subscription_plan_id,
        subscription_status,
        selected_addon,
        subscription_start_date,
        subscription_end_date,
        stripe_customer_id,
        stripe_subscription_id
      FROM clinicians
      WHERE id = $1`,
      [userId]
    );

    if (!result.success || !result.data || result.data.length === 0) {
      return null;
    }

    return result.data[0];
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
}

/**
 * Check if user has access to a feature
 */
function checkFeatureAccess(subscription, featureId) {
  const planId = subscription.subscription_plan_id || 'essential';
  const plan = SUBSCRIPTION_PLANS[planId];

  if (!plan) {
    return {
      allowed: false,
      reason: 'invalid_plan',
      message: 'Invalid subscription plan'
    };
  }

  // Check subscription status
  if (subscription.subscription_status !== 'active') {
    return {
      allowed: false,
      reason: 'inactive_subscription',
      message: 'Subscription is not active'
    };
  }

  // Complete Suite has access to everything
  if (planId === 'complete') {
    return {
      allowed: true,
      plan: 'complete',
      reason: 'complete_suite'
    };
  }

  // Get feature access from plan
  const featureAccess = plan.features[featureId];

  // Feature not available in this plan
  if (featureAccess === false || featureAccess === undefined) {
    return {
      allowed: false,
      reason: 'upgrade_required',
      message: `This feature requires a higher tier subscription`,
      currentPlan: planId,
      requiredPlans: ['professional', 'complete']
    };
  }

  // Feature requires addon (Professional plan)
  if (featureAccess === 'addon') {
    const requiredAddon = getRequiredAddon(featureId);

    if (subscription.selected_addon === requiredAddon) {
      return {
        allowed: true,
        plan: 'professional',
        addon: requiredAddon,
        reason: 'addon_selected'
      };
    }

    return {
      allowed: false,
      reason: 'addon_required',
      message: `This feature requires the ${requiredAddon} addon`,
      currentPlan: planId,
      selectedAddon: subscription.selected_addon,
      requiredAddon: requiredAddon
    };
  }

  // Feature is directly available
  if (featureAccess === true) {
    return {
      allowed: true,
      plan: planId,
      reason: 'plan_feature'
    };
  }

  return {
    allowed: false,
    reason: 'unknown',
    message: 'Unable to determine feature access'
  };
}

/**
 * Get required addon for a feature
 */
function getRequiredAddon(featureId) {
  const addonMap = {
    aiClinicalNotes: 'ai_notes',
    integratedTelehealth: 'telehealth'
  };

  return addonMap[featureId] || null;
}

/**
 * Update user's subscription plan
 */
async function updateSubscriptionPlan(userId, planId, stripeData = {}) {
  try {
    await initDatabase();

    const result = await executeQuery(
      `UPDATE clinicians
       SET
         subscription_plan_id = $1,
         subscription_status = $2,
         stripe_customer_id = COALESCE($3, stripe_customer_id),
         stripe_subscription_id = COALESCE($4, stripe_subscription_id),
         subscription_start_date = COALESCE($5, subscription_start_date)
       WHERE id = $6
       RETURNING *`,
      [
        planId,
        stripeData.status || 'active',
        stripeData.customerId || null,
        stripeData.subscriptionId || null,
        stripeData.startDate || new Date().toISOString(),
        userId
      ]
    );

    return {
      success: result.success,
      data: result.data?.[0] || null,
      error: result.error || null
    };
  } catch (error) {
    console.error('Update subscription error:', error);
    return {
      success: false,
      data: null,
      error: error.message
    };
  }
}

/**
 * Update user's selected addon (Professional plan only)
 */
async function updateSelectedAddon(userId, addonId) {
  try {
    await initDatabase();

    // Verify user is on Professional plan
    const subscription = await getUserSubscription(userId);
    if (!subscription || subscription.subscription_plan_id !== 'professional') {
      return {
        success: false,
        error: 'Addon selection is only available for Professional plan subscribers'
      };
    }

    // Validate addon
    const validAddons = ['ai_notes', 'telehealth'];
    if (!validAddons.includes(addonId)) {
      return {
        success: false,
        error: 'Invalid addon ID'
      };
    }

    const result = await executeQuery(
      `UPDATE clinicians
       SET selected_addon = $1
       WHERE id = $2
       RETURNING *`,
      [addonId, userId]
    );

    return {
      success: result.success,
      data: result.data?.[0] || null,
      error: result.error || null
    };
  } catch (error) {
    console.error('Update addon error:', error);
    return {
      success: false,
      data: null,
      error: error.message
    };
  }
}

// Export handler and utilities
module.exports = handler;
module.exports.getUserSubscription = getUserSubscription;
module.exports.checkFeatureAccess = checkFeatureAccess;
module.exports.updateSubscriptionPlan = updateSubscriptionPlan;
module.exports.updateSelectedAddon = updateSelectedAddon;
