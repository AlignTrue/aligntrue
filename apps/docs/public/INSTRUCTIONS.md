# Instructions for Adding Assets

## 1. Add Open Graph Image

Your AlignTrue logo image needs to be resized and saved as the OG image.

**Steps:**

1. Open your AlignTrue logo image (the one you provided)
2. Resize to exactly **1200 x 630 pixels**
3. Save as `og-image.png`
4. Place in this directory: `apps/docs/public/og-image.png`

**Why this size?**

- 1200x630 is the standard Open Graph image size
- Works for Facebook, LinkedIn, Twitter, and most social platforms
- Ensures your logo displays correctly when links are shared

## 2. Add Favicon

**Steps:**

1. Take your `favicon.ico` file
2. Place in this directory: `apps/docs/public/favicon.ico`

**Note:** Next.js will automatically serve it at `/favicon.ico`

## 3. Add Google Analytics ID

**Steps:**

1. Go to Google Analytics 4 and get your tracking ID (format: `G-XXXXXXXXXX`)
2. In Vercel project settings, add environment variable:
   - Name: `NEXT_PUBLIC_GA_ID`
   - Value: Your GA4 tracking ID
3. Redeploy the site

**Current status:** The code is ready and will automatically enable GA4 when the ID is set.

## Verification

After adding the assets:

### Test OG Image

1. Deploy to production
2. Test with these tools:
   - Twitter: https://cards-dev.twitter.com/validator
   - Facebook: https://developers.facebook.com/tools/debug/
   - LinkedIn: https://www.linkedin.com/post-inspector/

### Test Favicon

1. Open your site in a browser
2. Check the browser tab for your icon

### Test Analytics

1. Visit your site
2. Check Vercel Analytics dashboard (automatic)
3. Check Google Analytics Real-Time reports (after adding GA ID)

## Current Status

- [ ] og-image.png (1200x630) - **NEEDS TO BE ADDED**
- [ ] favicon.ico - **NEEDS TO BE ADDED**
- [ ] NEXT_PUBLIC_GA_ID - **NEEDS TO BE ADDED TO VERCEL**

## File Locations

```
apps/docs/public/
├── og-image.png       ← Add here (1200x630)
├── favicon.ico        ← Add here
├── README.md
├── INSTRUCTIONS.md    ← You are here
└── .gitkeep
```
