// Subscription Plans Configuration
// Defines the three-tier subscription model for Sessionably

const SUBSCRIPTION_PLANS = {
  essential: {
    id: 'essential',
    name: 'Essential EHR',
    price: 40,
    priceId: 'price_essential_40', // TODO: Update with actual Stripe Price ID
    features: {
      clientManagement: true,
      appointmentScheduling: true,
      billingInvoicing: true,
      manualClinicalNotes: true,
      clientPortal: true,
      documentStorage: '50GB',
      digitalSignatures: true,
      hipaaCompliant: true,
      aiClinicalNotes: false,
      integratedTelehealth: false,
      multiClinician: false,
      storageLimit: 50,
      prioritySupport: false
    },
    description: 'Essential practice management tools',
    limitations: [
      'Manual notes only (no AI)',
      'No telehealth integration',
      '50GB storage'
    ]
  },

  professional: {
    id: 'professional',
    name: 'Professional',
    price: 60,
    priceId: 'price_professional_60', // TODO: Update with actual Stripe Price ID
    features: {
      clientManagement: true,
      appointmentScheduling: true,
      billingInvoicing: true,
      manualClinicalNotes: true,
      clientPortal: true,
      documentStorage: '100GB',
      digitalSignatures: true,
      hipaaCompliant: true,
      aiClinicalNotes: 'addon', // Requires addon selection
      integratedTelehealth: 'addon', // Requires addon selection
      multiClinician: false,
      storageLimit: 100,
      prioritySupport: true,
      addonRequired: true // User must choose ONE addon
    },
    description: 'Everything in Essential + choose AI Notes OR Telehealth',
    addons: ['ai_notes', 'telehealth'],
    limitations: [
      'Choose ONE addon: AI Notes OR Telehealth',
      'Change addon once per billing cycle',
      '100GB storage'
    ]
  },

  complete: {
    id: 'complete',
    name: 'Complete Suite',
    price: 75,
    priceId: 'price_complete_75', // TODO: Update with actual Stripe Price ID
    features: {
      clientManagement: true,
      appointmentScheduling: true,
      billingInvoicing: true,
      manualClinicalNotes: true,
      clientPortal: true,
      documentStorage: '250GB',
      digitalSignatures: true,
      hipaaCompliant: true,
      aiClinicalNotes: true,
      integratedTelehealth: true,
      multiClinician: true,
      storageLimit: 250,
      prioritySupport: true,
      premiumSupport: true
    },
    description: 'Everything included - AI Notes + Telehealth + Multi-clinician',
    limitations: []
  }
};

// Feature definitions with upgrade messaging
const FEATURES = {
  aiClinicalNotes: {
    id: 'aiClinicalNotes',
    name: 'AI-Powered Clinical Notes',
    description: 'Generate comprehensive clinical notes with AI assistance',
    icon: '🤖',
    requiredPlans: ['professional', 'complete'],
    addonKey: 'ai_notes',
    upgradeMessage: {
      essential: 'Upgrade to Professional or Complete Suite to unlock AI-powered clinical notes',
      professional: 'Select AI Notes as your Professional addon to use this feature'
    }
  },

  integratedTelehealth: {
    id: 'integratedTelehealth',
    name: 'Integrated Telehealth',
    description: 'Conduct secure video sessions directly within the platform',
    icon: '📹',
    requiredPlans: ['professional', 'complete'],
    addonKey: 'telehealth',
    upgradeMessage: {
      essential: 'Upgrade to Professional or Complete Suite to unlock telehealth capabilities',
      professional: 'Select Telehealth as your Professional addon to use this feature'
    }
  }
};

// Addon configurations
const ADDONS = {
  ai_notes: {
    id: 'ai_notes',
    name: 'AI NoteTaker',
    description: 'AI-powered clinical note generation',
    feature: 'aiClinicalNotes',
    icon: '🤖'
  },

  telehealth: {
    id: 'telehealth',
    name: 'Telehealth',
    description: 'Integrated video sessions',
    feature: 'integratedTelehealth',
    icon: '📹'
  }
};

// Helper functions
const SubscriptionHelpers = {
  /**
   * Get user's current subscription from localStorage
   */
  getCurrentSubscription() {
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
    return user.subscription || {
      planId: 'essential',
      status: 'active',
      selectedAddon: null,
      startDate: new Date().toISOString()
    };
  },

  /**
   * Update user's subscription in localStorage
   */
  updateSubscription(subscriptionData) {
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
    user.subscription = {
      ...user.subscription,
      ...subscriptionData
    };
    localStorage.setItem('currentUser', JSON.stringify(user));
  },

  /**
   * Get plan details by ID
   */
  getPlan(planId) {
    return SUBSCRIPTION_PLANS[planId] || SUBSCRIPTION_PLANS.essential;
  },

  /**
   * Check if user has access to a specific feature
   */
  hasFeatureAccess(featureId) {
    const subscription = this.getCurrentSubscription();
    const plan = this.getPlan(subscription.planId);
    const feature = FEATURES[featureId];

    if (!feature) {
      console.error(`Feature ${featureId} not found`);
      return { allowed: false, reason: 'Feature not found' };
    }

    // Complete Suite has access to everything
    if (subscription.planId === 'complete') {
      return { allowed: true, plan: 'complete' };
    }

    // Essential plan check
    if (subscription.planId === 'essential') {
      if (!plan.features[featureId]) {
        return {
          allowed: false,
          reason: 'upgrade_required',
          message: feature.upgradeMessage.essential,
          requiredPlans: feature.requiredPlans
        };
      }
    }

    // Professional plan check
    if (subscription.planId === 'professional') {
      const featureValue = plan.features[featureId];

      // If feature requires addon
      if (featureValue === 'addon') {
        const addon = ADDONS[feature.addonKey];

        // Check if user has selected this addon
        if (subscription.selectedAddon === feature.addonKey) {
          return { allowed: true, plan: 'professional', addon: feature.addonKey };
        }

        return {
          allowed: false,
          reason: 'addon_required',
          message: feature.upgradeMessage.professional,
          availableAction: 'select_addon'
        };
      }

      // Feature is directly available
      if (featureValue === true) {
        return { allowed: true, plan: 'professional' };
      }

      return {
        allowed: false,
        reason: 'feature_not_available',
        message: feature.upgradeMessage.professional
      };
    }

    return { allowed: false, reason: 'Unknown subscription state' };
  },

  /**
   * Get upgrade options for a feature
   */
  getUpgradeOptions(featureId) {
    const feature = FEATURES[featureId];
    if (!feature) return [];

    const subscription = this.getCurrentSubscription();
    const options = [];

    if (subscription.planId === 'essential') {
      // Can upgrade to Professional or Complete
      options.push({
        plan: 'professional',
        name: 'Professional',
        price: SUBSCRIPTION_PLANS.professional.price,
        note: 'Includes this feature as an addon option'
      });
      options.push({
        plan: 'complete',
        name: 'Complete Suite',
        price: SUBSCRIPTION_PLANS.complete.price,
        note: 'Includes everything'
      });
    } else if (subscription.planId === 'professional') {
      const addon = ADDONS[feature.addonKey];

      // If addon not selected, can select it
      if (!subscription.selectedAddon) {
        options.push({
          action: 'select_addon',
          addon: feature.addonKey,
          name: `Select ${addon.name} addon`,
          note: 'Included in your Professional plan'
        });
      } else if (subscription.selectedAddon !== feature.addonKey) {
        // Can change addon or upgrade to Complete
        options.push({
          action: 'change_addon',
          addon: feature.addonKey,
          name: `Switch to ${addon.name} addon`,
          note: 'Change once per billing cycle'
        });
      }

      // Can always upgrade to Complete
      options.push({
        plan: 'complete',
        name: 'Upgrade to Complete Suite',
        price: SUBSCRIPTION_PLANS.complete.price,
        note: 'Get both AI Notes and Telehealth'
      });
    }

    return options;
  }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.SUBSCRIPTION_PLANS = SUBSCRIPTION_PLANS;
  window.FEATURES = FEATURES;
  window.ADDONS = ADDONS;
  window.SubscriptionHelpers = SubscriptionHelpers;
}

// Export for Node.js (if needed)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SUBSCRIPTION_PLANS,
    FEATURES,
    ADDONS,
    SubscriptionHelpers
  };
}
