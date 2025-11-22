# Sessionably Brand Guidelines

**Official brand guidelines for the Sessionably Practice Management Suite**

---

## Logo

The Sessionably logo consists of **two overlapping circles** representing the connection between therapist and client—the space where sessions happen.

### Logo Variations

#### 1. Primary Logo — With Tagline
- **File**: `/public/assets/logos/sessionably-logo.svg`
- **Usage**: Headers, login pages, light backgrounds
- **Contains**: Overlapping circles + "SESSIONABLY" + "PRACTICE MANAGEMENT SUITE"

#### 2. Secondary Logo — Without Tagline
- **Usage**: Compact spaces where tagline won't fit
- **Contains**: Overlapping circles + "SESSIONABLY" only

#### 3. Icon Only
- **File**: `/public/assets/logos/sessionably-icon.svg`
- **Usage**: Favicons, app icons, very compact spaces
- **Sizes**: 80px, 60px, 40px, 30px

---

## Brand Colors

### Primary Colors
- **Teal** (Primary): `#00B4A6` - RGB(0, 180, 166)
- **Amber** (Accent): `#F4A443` - RGB(244, 164, 67)

### Supporting Colors
- **Navy** (Dark/Text): `#1A1A2E` - RGB(26, 26, 46)
- **Off-White** (Light BG): `#FAFAFA` - RGB(250, 250, 250)
- **Gray** (Text): `#888888` - RGB(136, 136, 136)

### CSS Variables
```css
:root {
  --color-primary: #00B4A6;
  --color-accent: #F4A443;
  --color-dark: #1A1A2E;
  --color-light: #FAFAFA;
  --color-gray: #888888;

  --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-weight-bold: 600;
  --letter-spacing: 3px;
}
```

---

## Typography

### Wordmark
- **Font**: System Sans-Serif (Helvetica, SF Pro, Segoe UI)
- **Weight**: Bold (600) | Semi-Bold
- **Letter Spacing**: 3px
- **Case**: ALL CAPS
- **Text**: "SESSIONABLY"

### Tagline
- **Text**: "PRACTICE MANAGEMENT SUITE"
- **Font**: Same as wordmark
- **Weight**: Regular (400)
- **Letter Spacing**: 1px
- **Case**: ALL CAPS
- **Size**: Smaller than wordmark

---

## App Icons

### iOS App Icon
- **Background**: Teal (#00B4A6)
- **Icon**: White overlapping circles with amber accent
- **Shape**: Rounded square (iOS standard)

### Android App Icon
- **Background**: Navy (#1A1A2E)
- **Icon**: Teal and amber overlapping circles
- **Shape**: Rounded square (Android standard)

### Favicon
- **Size**: 32x32px recommended
- **File**: `/icon.svg`
- **Design**: Simplified overlapping circles on teal background

---

## Clear Space

Maintain minimum clear space around the logo equal to the **height of the icon** (the overlapping circles).

```
┌─────────────────────┐
│  ← 1x icon height → │
│                     │
│    ⚪⚪  SESSIONABLY │
│                     │
│  ← 1x icon height → │
└─────────────────────┘
```

---

## Logo Usage Guidelines

### ✅ DO
- Use the official logo files provided
- Maintain proper clear space
- Use on solid backgrounds with sufficient contrast
- Scale proportionally
- Use light logo on dark backgrounds, dark logo on light backgrounds

### ❌ DON'T
- Modify logo colors (except approved variations)
- Distort or stretch the logo
- Add effects (shadows, gradients) to the logo
- Rotate the logo
- Place on busy backgrounds without proper contrast
- Recreate the logo from scratch

---

## Color Variations

### Full Color — Light Background
- **Logo**: Teal + Amber circles
- **Text**: Navy (#1A1A2E)
- **Use**: Default, most common

### Full Color — Dark Background
- **Logo**: Teal + Amber circles
- **Text**: White (#FFFFFF)
- **Use**: Dark mode, navy backgrounds

### Monochrome Teal
- **Logo**: All teal (#00B4A6)
- **Use**: Single-color printing, teal backgrounds

### White — Brand Background
- **Logo**: White circles
- **Background**: Teal (#00B4A6)
- **Use**: App icons, solid color applications

### Black — Print
- **Logo**: All black
- **Use**: Black and white printing only

### White — Black Background
- **Logo**: White circles
- **Background**: Black
- **Use**: High contrast dark mode

---

## File Locations

```
/public/assets/logos/
├── sessionably-logo.svg          # Primary logo with tagline (light)
├── sessionably-logo-dark.svg     # Primary logo with tagline (dark)
└── sessionably-icon.svg          # Icon only (circles)

/icon.svg                         # Favicon (512x512)
```

---

## Quick Reference

### Colors
```
Primary (Teal):    #00B4A6  rgb(0, 180, 166)
Accent (Amber):    #F4A443  rgb(244, 164, 67)
Dark (Navy):       #1A1A2E  rgb(26, 26, 46)
Light (Off-White): #FAFAFA  rgb(250, 250, 250)
Gray (Text):       #888888  rgb(136, 136, 136)
```

### Typography
```
Font Family:      -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
Font Weight:      600 (Semi-Bold)
Letter Spacing:   3px
Text Transform:   uppercase
```

### Tailwind Config
```javascript
colors: {
  primary: '#00B4A6',
  accent: '#F4A443',
  dark: '#1A1A2E',
  light: '#FAFAFA',
}
```

---

## Implementation Examples

### HTML Logo Usage
```html
<!-- Landing page header -->
<img src="/public/assets/logos/sessionably-logo.svg"
     alt="Sessionably - Practice Management Suite"
     style="height: 40px; width: auto;">

<!-- Login page -->
<img src="/public/assets/logos/sessionably-logo.svg"
     alt="Sessionably - Practice Management Suite"
     style="height: 60px; width: auto;">

<!-- Favicon -->
<link rel="icon" href="/icon.svg" type="image/svg+xml">
```

---

**Last Updated**: 2025-11-22
**Version**: 1.0
**Repository**: ClinicalCanvasEHR (Sessionably Platform)

For questions about brand usage or additional assets, refer to this document and the official brand design files.
