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
      aiClinicalNotes: false, // Not included (Complete only)
      integratedTelehealth: true, // Included in Professional+
      multiClinician: false,
      storageLimit: 100,
      prioritySupport: true
    },
    description: 'Everything in Essential + Telehealth',
    limitations: [
      'No AI-powered clinical notes',
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
    requiredPlans: ['complete'],
    upgradeMessage: {
      essential: 'Upgrade to Complete Suite to unlock AI-powered clinical notes',
      professional: 'Upgrade to Complete Suite to unlock AI-powered clinical notes'
    }
  },

  integratedTelehealth: {
    id: 'integratedTelehealth',
    name: 'Integrated Telehealth',
    description: 'Conduct secure video sessions directly within the platform',
    icon: '📹',
    requiredPlans: ['professional', 'complete'],
    upgradeMessage: {
      essential: 'Upgrade to Professional or Complete Suite to unlock telehealth capabilities',
      professional: 'Included in your plan'
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

    // Get feature value from plan
    const featureValue = plan.features[featureId];

    // Feature is directly available in the plan
    if (featureValue === true) {
      return { allowed: true, plan: subscription.planId };
    }

    // Feature not available in this plan
    if (featureValue === false || featureValue === undefined) {
      const message = feature.upgradeMessage[subscription.planId] || feature.upgradeMessage.essential;
      return {
        allowed: false,
        reason: 'upgrade_required',
        message: message,
        requiredPlans: feature.requiredPlans
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

    // Essential users can upgrade to Professional or Complete
    if (subscription.planId === 'essential') {
      // For Telehealth: Professional or Complete
      if (featureId === 'integratedTelehealth') {
        options.push({
          plan: 'professional',
          name: 'Professional',
          price: SUBSCRIPTION_PLANS.professional.price,
          note: 'Includes Telehealth'
        });
      }

      // For AI Notes or any feature: Complete
      options.push({
        plan: 'complete',
        name: 'Complete Suite',
        price: SUBSCRIPTION_PLANS.complete.price,
        note: 'Includes everything: AI Notes + Telehealth'
      });
    }
    // Professional users can only upgrade to Complete
    else if (subscription.planId === 'professional') {
      options.push({
        plan: 'complete',
        name: 'Upgrade to Complete Suite',
        price: SUBSCRIPTION_PLANS.complete.price,
        note: 'Add AI Notes and Multi-clinician support'
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
