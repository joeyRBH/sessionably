// Feature Gate Middleware
// Checks feature access and displays upgrade prompts

(function(window) {
  'use strict';

  /**
   * Feature Gate - Main access control system
   */
  const FeatureGate = {
    /**
     * Check if user has access to a feature
     * @param {string} featureId - The feature to check (e.g., 'aiClinicalNotes')
     * @returns {object} Access result with allowed status and details
     */
    checkFeature(featureId) {
      if (!window.SubscriptionHelpers) {
        console.error('SubscriptionHelpers not loaded. Include subscription-plans.js first.');
        return { allowed: false, reason: 'system_error' };
      }

      return window.SubscriptionHelpers.hasFeatureAccess(featureId);
    },

    /**
     * Show upgrade prompt modal for a feature
     * @param {string} featureId - The feature that requires upgrade
     */
    showUpgradePrompt(featureId) {
      const feature = window.FEATURES?.[featureId];
      if (!feature) {
        console.error(`Feature ${featureId} not found`);
        return;
      }

      const access = this.checkFeature(featureId);
      const subscription = window.SubscriptionHelpers.getCurrentSubscription();
      const upgradeOptions = window.SubscriptionHelpers.getUpgradeOptions(featureId);

      // Create modal HTML
      const modalHTML = this._createUpgradeModal(feature, access, subscription, upgradeOptions);

      // Check if modal already exists, remove it
      const existingModal = document.getElementById('feature-upgrade-modal');
      if (existingModal) {
        existingModal.remove();
      }

      // Add modal to page
      document.body.insertAdjacentHTML('beforeend', modalHTML);

      // Show modal
      const modal = document.getElementById('feature-upgrade-modal');
      modal.classList.add('active');

      // Setup event listeners
      this._setupModalListeners(modal, upgradeOptions);
    },

    /**
     * Create upgrade modal HTML
     */
    _createUpgradeModal(feature, access, subscription, upgradeOptions) {
      const currentPlan = window.SubscriptionHelpers.getPlan(subscription.planId);

      return `
        <div id="feature-upgrade-modal" class="modal">
          <div class="modal-content" style="max-width: 600px;">
            <button class="close-btn" onclick="window.featureGate.closeUpgradePrompt()">&times;</button>

            <div class="modal-header" style="text-align: center;">
              <div style="font-size: 3rem; margin-bottom: 1rem;">${feature.icon}</div>
              <h2>${feature.name}</h2>
              <p style="color: var(--text-secondary); margin-top: 0.5rem;">
                ${feature.description}
              </p>
            </div>

            <div style="background: var(--primary-subtle); padding: 1rem; border-radius: var(--border-radius); margin: 1.5rem 0;">
              <p style="color: var(--text-primary); font-weight: 500; margin: 0;">
                ${access.message || 'This feature requires a subscription upgrade'}
              </p>
            </div>

            <div style="margin: 1.5rem 0;">
              <h3 style="font-size: 1.1rem; margin-bottom: 1rem;">Current Plan: ${currentPlan.name} ($${currentPlan.price}/mo)</h3>

              ${upgradeOptions.length > 0 ? `
                <h3 style="font-size: 1.1rem; margin-bottom: 1rem; margin-top: 1.5rem;">Upgrade Options:</h3>
                <div style="display: flex; flex-direction: column; gap: 1rem;">
                  ${upgradeOptions.map((option, index) => this._createOptionCard(option, index)).join('')}
                </div>
              ` : ''}
            </div>

            <div style="margin-top: 2rem; text-align: center;">
              <button class="btn btn-secondary" onclick="window.featureGate.closeUpgradePrompt()">
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      `;
    },

    /**
     * Create option card HTML
     */
    _createOptionCard(option, index) {
      if (option.action === 'select_addon') {
        return `
          <div class="upgrade-option-card" style="border: 2px solid var(--primary-color); padding: 1.5rem; border-radius: var(--border-radius); cursor: pointer;"
               data-action="${option.action}" data-addon="${option.addon}">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <h4 style="font-size: 1.1rem; margin-bottom: 0.5rem;">✓ ${option.name}</h4>
                <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0;">${option.note}</p>
              </div>
              <button class="btn btn-primary" onclick="window.featureGate.selectAddon('${option.addon}'); event.stopPropagation();">
                Select Addon
              </button>
            </div>
          </div>
        `;
      } else if (option.action === 'change_addon') {
        return `
          <div class="upgrade-option-card" style="border: 2px solid var(--border-color); padding: 1.5rem; border-radius: var(--border-radius);"
               data-action="${option.action}" data-addon="${option.addon}">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <h4 style="font-size: 1.1rem; margin-bottom: 0.5rem;">${option.name}</h4>
                <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0;">${option.note}</p>
              </div>
              <button class="btn btn-secondary" onclick="window.featureGate.changeAddon('${option.addon}'); event.stopPropagation();">
                Change Addon
              </button>
            </div>
          </div>
        `;
      } else if (option.plan) {
        return `
          <div class="upgrade-option-card" style="border: 2px solid var(--border-color); padding: 1.5rem; border-radius: var(--border-radius);"
               data-plan="${option.plan}">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <h4 style="font-size: 1.1rem; margin-bottom: 0.5rem;">${option.name} - $${option.price}/mo</h4>
                <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0;">${option.note}</p>
              </div>
              <button class="btn btn-primary" onclick="window.featureGate.upgradePlan('${option.plan}'); event.stopPropagation();">
                Upgrade
              </button>
            </div>
          </div>
        `;
      }
    },

    /**
     * Setup modal event listeners
     */
    _setupModalListeners(modal, upgradeOptions) {
      // Close on background click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closeUpgradePrompt();
        }
      });

      // Close on Escape key
      const escapeHandler = (e) => {
        if (e.key === 'Escape') {
          this.closeUpgradePrompt();
          document.removeEventListener('keydown', escapeHandler);
        }
      };
      document.addEventListener('keydown', escapeHandler);
    },

    /**
     * Close upgrade prompt modal
     */
    closeUpgradePrompt() {
      const modal = document.getElementById('feature-upgrade-modal');
      if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
      }
    },

    /**
     * Select addon for Professional plan
     */
    selectAddon(addonId) {
      const addon = window.ADDONS?.[addonId];
      if (!addon) {
        console.error(`Addon ${addonId} not found`);
        return;
      }

      const subscription = window.SubscriptionHelpers.getCurrentSubscription();

      if (subscription.planId !== 'professional') {
        alert('Addon selection is only available for Professional plan subscribers.');
        return;
      }

      if (subscription.selectedAddon) {
        alert('You have already selected an addon. You can change it once per billing cycle.');
        return;
      }

      // Update subscription with selected addon
      window.SubscriptionHelpers.updateSubscription({
        selectedAddon: addonId,
        addonSelectedDate: new Date().toISOString()
      });

      // Show success notification
      if (window.showNotification) {
        window.showNotification(`${addon.name} addon activated! You now have access to ${addon.description}.`, 'success');
      } else {
        alert(`${addon.name} addon activated!`);
      }

      // Close modal
      this.closeUpgradePrompt();

      // Reload page to reflect changes
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    },

    /**
     * Change addon for Professional plan
     */
    changeAddon(addonId) {
      const addon = window.ADDONS?.[addonId];
      if (!addon) {
        console.error(`Addon ${addonId} not found`);
        return;
      }

      const subscription = window.SubscriptionHelpers.getCurrentSubscription();

      if (subscription.planId !== 'professional') {
        alert('Addon selection is only available for Professional plan subscribers.');
        return;
      }

      // Check if addon was changed this billing cycle
      if (subscription.addonChangedThisCycle) {
        alert('You can only change your addon once per billing cycle. Please try again next month.');
        return;
      }

      const currentAddon = window.ADDONS[subscription.selectedAddon];
      const confirmChange = confirm(
        `Are you sure you want to switch from ${currentAddon?.name || 'current addon'} to ${addon.name}? ` +
        `This change will take effect immediately and you can only change once per billing cycle.`
      );

      if (!confirmChange) return;

      // Update subscription with new addon
      window.SubscriptionHelpers.updateSubscription({
        selectedAddon: addonId,
        addonChangedThisCycle: true,
        addonSelectedDate: new Date().toISOString()
      });

      // Show success notification
      if (window.showNotification) {
        window.showNotification(`Switched to ${addon.name} addon successfully!`, 'success');
      } else {
        alert(`Switched to ${addon.name} addon!`);
      }

      // Close modal
      this.closeUpgradePrompt();

      // Reload page to reflect changes
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    },

    /**
     * Upgrade to a different plan
     */
    upgradePlan(planId) {
      const plan = window.SUBSCRIPTION_PLANS?.[planId];
      if (!plan) {
        console.error(`Plan ${planId} not found`);
        return;
      }

      const confirmUpgrade = confirm(
        `Upgrade to ${plan.name} for $${plan.price}/month?\n\n` +
        `This will give you access to: ${plan.description}`
      );

      if (!confirmUpgrade) return;

      // TODO: Integrate with Stripe Checkout
      // For now, just update localStorage
      window.SubscriptionHelpers.updateSubscription({
        planId: planId,
        status: 'active',
        upgradeDate: new Date().toISOString()
      });

      // Show success notification
      if (window.showNotification) {
        window.showNotification(`Successfully upgraded to ${plan.name}!`, 'success');
      } else {
        alert(`Successfully upgraded to ${plan.name}!`);
      }

      // Close modal
      this.closeUpgradePrompt();

      // Reload page to reflect changes
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    },

    /**
     * Add visual indicator (lock icon) to a button or element
     */
    addLockIndicator(elementId, featureId) {
      const element = document.getElementById(elementId);
      if (!element) return;

      const access = this.checkFeature(featureId);
      if (access.allowed) return; // No lock needed

      // Add lock icon
      const lockIcon = document.createElement('span');
      lockIcon.innerHTML = ' 🔒';
      lockIcon.style.marginLeft = '0.5rem';
      element.appendChild(lockIcon);

      // Add disabled styling
      element.style.opacity = '0.6';
      element.style.cursor = 'not-allowed';
    },

    /**
     * Add PRO badge to a feature
     */
    addProBadge(elementId) {
      const element = document.getElementById(elementId);
      if (!element) return;

      const badge = document.createElement('span');
      badge.innerHTML = 'PRO';
      badge.style.cssText = `
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        font-size: 0.7rem;
        font-weight: 700;
        margin-left: 0.5rem;
        text-transform: uppercase;
      `;
      element.appendChild(badge);
    }
  };

  // Testing utilities for browser console
  const TEST_SUBSCRIPTION = {
    testEssential() {
      window.SubscriptionHelpers.updateSubscription({
        planId: 'essential',
        status: 'active',
        selectedAddon: null
      });
      console.log('✅ Set to Essential plan');
      window.location.reload();
    },

    testProfessional() {
      window.SubscriptionHelpers.updateSubscription({
        planId: 'professional',
        status: 'active',
        selectedAddon: null
      });
      console.log('✅ Set to Professional plan (includes Telehealth)');
      window.location.reload();
    },

    testComplete() {
      window.SubscriptionHelpers.updateSubscription({
        planId: 'complete',
        status: 'active',
        selectedAddon: null
      });
      console.log('✅ Set to Complete Suite plan');
      window.location.reload();
    },

    setAddon(addonId) {
      console.warn('⚠️ Addons are deprecated in the simplified tier model.');
      console.log('Professional plan now includes Telehealth by default.');
      console.log('AI Notes are only available in the Complete plan.');
    },

    showCurrentPlan() {
      const subscription = window.SubscriptionHelpers.getCurrentSubscription();
      const plan = window.SubscriptionHelpers.getPlan(subscription.planId);
      console.log('Current Subscription:', {
        plan: plan.name,
        planId: subscription.planId,
        selectedAddon: subscription.selectedAddon || 'None',
        status: subscription.status
      });
    },

    testAINotesAccess() {
      const access = window.featureGate.checkFeature('aiClinicalNotes');
      console.log('AI Notes Access:', access);
    },

    testTelehealthAccess() {
      const access = window.featureGate.checkFeature('integratedTelehealth');
      console.log('Telehealth Access:', access);
    }
  };

  // Export to window
  window.featureGate = FeatureGate;
  window.TEST_SUBSCRIPTION = TEST_SUBSCRIPTION;

  // Log successful load
  console.log('✅ Feature Gate loaded successfully');

})(window);
