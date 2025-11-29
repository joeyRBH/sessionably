# Stripe Configuration Updates - Phase 3

## Overview
This document outlines the required Stripe product and pricing updates as part of Phase 3 of the Sessionably Simplification Guide.

## Required Actions

### 1. Update Stripe Products (dashboard.stripe.com)

Navigate to Products section in Stripe Dashboard and update/create the following products with 7-day trial periods:

#### Essential Plan
- **Price**: $40/month
- **Price ID**: `price_essential_40`
- **Trial Period**: 7 days
- **Features**:
  - HIPAA-compliant EHR
  - Client management
  - Appointment scheduling
  - Secure document storage
  - Basic billing & invoicing

#### Professional Plan
- **Price**: $60/month
- **Price ID**: `price_professional_60`
- **Trial Period**: 7 days
- **Features**:
  - Everything in Essential
  - AI-powered clinical notes
  - Advanced analytics
  - SMS notifications (via Twilio)
  - Telehealth integration

#### Complete Suite
- **Price**: $75/month
- **Price ID**: `price_complete_75`
- **Trial Period**: 7 days
- **Features**:
  - Everything in Professional
  - Advanced reporting
  - Multi-provider support
  - Custom branding
  - Priority support

### 2. Update Vercel Environment Variables

After creating/updating the Stripe prices, update the following environment variables in your Vercel project:

```bash
STRIPE_PRICE_ESSENTIAL=price_essential_40
STRIPE_PRICE_PROFESSIONAL=price_professional_60
STRIPE_PRICE_COMPLETE=price_complete_75
```

**Steps:**
1. Go to your Vercel Dashboard
2. Navigate to your project → Settings → Environment Variables
3. Update the three price ID variables listed above
4. Redeploy the application to apply changes

### 3. Update Stripe Pricing Table (if applicable)

If using Stripe's embedded pricing table on index.html (line 1044-1047):
- The pricing table should automatically reflect the new prices
- Verify the pricing table ID: `prctbl_1SX4sA3acP2PN3DDoKRjYZsx`
- Ensure it's configured to show all three plans with 7-day trials

### 4. Verification Checklist

Before deploying to production:

- [ ] All three products created/updated in Stripe Dashboard
- [ ] Price IDs match exactly (price_essential_40, price_professional_60, price_complete_75)
- [ ] 7-day trial period configured for all plans
- [ ] Vercel environment variables updated
- [ ] Test checkout flow works correctly
- [ ] Verify trial period appears in checkout
- [ ] Confirm no credit card required during trial signup

## Current Pricing Summary

| Plan | Old Price | New Price | Price ID |
|------|-----------|-----------|----------|
| Essential | N/A | $40/month | price_essential_40 |
| Professional | N/A | $60/month | price_professional_60 |
| Complete Suite | $80/month | $75/month | price_complete_75 |

## Notes

- All plans include 7-day free trial
- No credit card required for trial
- Users can cancel anytime
- Trial automatically converts to paid subscription unless cancelled

## Implementation Date

Phase 3 - November 2025
