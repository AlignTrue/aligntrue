---
id: "aligns/base/base-web-quality"
version: "1.0.0"
summary: "Web quality baseline: accessibility, performance, resilience, mobile-first"
tags: ["web", "accessibility", "performance", "quality", "paved-road"]
---

# Web quality baseline

Web standards: accessibility, performance, resilience, and mobile-first design.

## Accessibility (a11y)

**WCAG 2.1 Level AA minimum:**

- **Keyboard navigation** - All functions accessible by keyboard
- **Color contrast** - 4.5:1 for normal text, 3:1 for large text
- **Alt text** - For all images and complex graphics
- **Semantic HTML** - `<button>`, `<label>`, `<nav>`, etc.
- **ARIA only when semantic markup insufficient** - Use native elements first

**Testing:**

- Screen reader testing (NVDA, JAWS, VoiceOver)
- Axe DevTools automated checks
- Keyboard-only navigation
- Color contrast analyzer

## Performance

**Mobile-first metrics (p75):**

- **LCP** - Largest Contentful Paint ≤ 2.5s
- **INP** - Interaction to Next Paint ≤ 200ms
- **CLS** - Cumulative Layout Shift ≤ 0.1
- **TTFB** - Time to First Byte ≤ 800ms

**Budgets per route:**

- **JavaScript** - ≤150 KB gzipped
- **CSS** - ≤50 KB gzipped
- **Hero image** - ≤200 KB
- **Fonts** - ≤150 KB total

**Techniques:**

- Image optimization and lazy loading
- Code splitting and dynamic imports
- Service workers for offline support
- Resource hints (preload, prefetch, dns-prefetch)

## Responsive design

- **Mobile-first** - Start with mobile, enhance for larger screens
- **Flexible layouts** - Use CSS grid and flexbox
- **Responsive images** - `srcset` and `sizes`
- **Touch-friendly** - 44×44px minimum tap targets
- **Typography scaling** - `clamp()` for fluid scaling

## Form accessibility

- **Label all inputs** - `<label for="id">`
- **Error messages** - Clear, associated with inputs
- **Focus management** - Visible focus indicator
- **Validation** - Client and server side
- **Success feedback** - Confirm submission

## Navigation

- **Skip links** - Jump to main content
- **Breadcrumbs** - Show location in site hierarchy
- **Consistent navigation** - Same location and behavior
- **Clear current page** - Highlight active link
- **Logical link text** - "Learn more" is bad, "Learn more about pricing" is good

## Mobile experience

- **Viewport meta tag** - `<meta name="viewport" content="width=device-width, initial-scale=1">`
- **Touch targets** - 44×44px minimum
- **Mobile menu** - Accessible hamburger menu
- **Avoid pop-ups** - Use modals sparingly
- **Test on real devices** - Not just browser emulation

## Resilience

- **Graceful degradation** - Works without JavaScript
- **Error pages** - 404, 500, offline states
- **Loading states** - Show progress for slow operations
- **Retry logic** - For failed requests
- **Offline support** - Service worker caching

## SEO

- **Semantic HTML** - Proper heading hierarchy
- **Meta tags** - Title, description, canonical
- **Open Graph** - Social media previews
- **Structured data** - Schema.org markup
- **XML sitemap** - For discovery
- **robots.txt** - Crawling directives

## Security

- **HTTPS only** - Secure transport
- **CSP headers** - Content Security Policy
- **CORS headers** - Cross-Origin Resource Sharing
- **XSS prevention** - Escape output, use framework defaults
- **CSRF protection** - Token validation

## Testing

- **Lighthouse CI** - Automated performance checks
- **Axe automation** - Accessibility scanning
- **Visual regression** - Screenshot comparisons
- **E2E on real devices** - Verifying mobile experience
- **Accessibility audit** - Manual review

## Deployment checklist

- [ ] Lighthouse score ≥90 (desktop), ≥80 (mobile)
- [ ] No accessibility violations (Axe)
- [ ] Meta tags complete and correct
- [ ] Sitemap submitted to search engines
- [ ] robots.txt configured
- [ ] Analytics configured
- [ ] Error tracking configured
- [ ] Performance monitoring enabled
