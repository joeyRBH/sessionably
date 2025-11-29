# Landing Page Image Update

## Overview
As part of the Sessionably Simplification Guide, the landing page hero image needs to be updated.

## Current Image
- **Location**: Likely in `/public/assets/` directory
- **Description**: Current image shows a person with a laptop (professional/tech-focused)

## Required Change
- **New Image**: Therapist + client talking (human connection focus)
- **Style**: Should convey warmth, trust, and human connection
- **Tone**: Professional but approachable, showing actual therapy/counseling session

## Implementation Steps

1. **Obtain New Image**
   - Stock photo showing therapist and client in conversation
   - Or commissioned illustration showing counseling session
   - Ensure image rights/licensing for commercial use

2. **Image Specifications**
   - Format: SVG (preferred) or high-quality PNG/WebP
   - Dimensions: At minimum 1200px wide for responsive design
   - Aspect ratio: 16:9 or similar for hero sections
   - File size: Optimized (< 200KB if possible)

3. **File Placement**
   - Save image to: `/public/assets/hero-image.png` (or appropriate name)
   - Or: `/public/assets/images/landing-hero.svg`

4. **Update HTML**
   - File: `/home/user/sessionably/index.html`
   - Section: Hero Image Section (around line 896-900)
   - Look for: `<section class="hero-image">` or similar
   - Update: `<img>` src attribute to point to new image

5. **Update Alt Text**
   - Change alt text to: "Therapist and client in counseling session"
   - Ensure accessibility compliance

## Design Notes
- Image should align with Sessionably brand colors (#00B4A6 primary teal)
- Should convey professionalism while emphasizing human connection
- Avoid overly clinical or sterile imagery
- Focus on emotional warmth and trust

## Testing
- Test responsive behavior on mobile, tablet, desktop
- Verify image loads quickly (< 2 seconds)
- Check contrast and readability of overlaid text (if any)

## Related Files
- `/home/user/sessionably/index.html` - Main landing page
- `/public/assets/` - Asset directory for images
- CSS styles in `index.html` (inline styles section)
