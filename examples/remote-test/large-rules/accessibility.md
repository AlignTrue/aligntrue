---
id: "large-rules/accessibility"
version: "1.0.0"
spec_version: "1"
summary: "Web accessibility standards and WCAG compliance"
---

# Accessibility standards

## WCAG Compliance

Follow WCAG 2.1 Level AA guidelines:

- Provide text alternatives for non-text content
- Provide captions for audio/video
- Make content adaptable to different presentations
- Use sufficient color contrast
- Make all functionality keyboard accessible
- Give users enough time to read content
- Don't use content that causes seizures
- Provide ways to navigate and find content
- Make text readable and understandable
- Make pages operate predictably
- Help users avoid and correct mistakes
- Maximize compatibility with assistive technologies

## Semantic HTML

Use semantic HTML elements:

- Use `<header>`, `<nav>`, `<main>`, `<footer>` for page structure
- Use `<article>`, `<section>`, `<aside>` for content organization
- Use `<button>` for buttons, not `<div>` with click handlers
- Use `<a>` for links, not buttons
- Use proper heading hierarchy (h1-h6)
- Use `<label>` for form inputs
- Use `<table>` for tabular data only
- Use lists (`<ul>`, `<ol>`) for list content

## ARIA Labels

Use ARIA appropriately:

- Add `aria-label` when visible label isn't sufficient
- Use `aria-labelledby` to reference existing labels
- Use `aria-describedby` for additional context
- Add `aria-live` for dynamic content updates
- Use `aria-hidden` to hide decorative elements
- Don't override native semantics unnecessarily
- Test with screen readers
- Follow ARIA authoring practices

Examples:

```html
<button aria-label="Close dialog">×</button>
<div role="alert" aria-live="assertive">Error occurred</div>
<nav aria-label="Main navigation">...</nav>
```

## Keyboard navigation

Ensure keyboard accessibility:

- All interactive elements must be keyboard accessible
- Provide visible focus indicators
- Support Tab, Enter, Space, Arrow keys appropriately
- Don't trap keyboard focus
- Provide skip links for navigation
- Use logical tab order
- Support keyboard shortcuts
- Test without mouse

## Color contrast

Maintain sufficient contrast:

- Normal text: 4.5:1 minimum contrast ratio
- Large text (18pt+): 3:1 minimum contrast ratio
- UI components: 3:1 minimum contrast ratio
- Don't rely on color alone to convey information
- Test with color blindness simulators
- Use contrast checking tools
- Provide high contrast mode option

## Form accessibility

Make forms accessible:

- Associate labels with inputs
- Provide clear error messages
- Indicate required fields
- Group related fields with fieldset/legend
- Provide helpful placeholder text
- Show validation errors clearly
- Support autocomplete attributes
- Make error recovery easy

Example:

```html
<label for="email">Email address *</label>
<input
  type="email"
  id="email"
  required
  aria-describedby="email-error"
  autocomplete="email"
/>
<span id="email-error" role="alert"> Please enter a valid email address </span>
```

## Images and Media

Provide alternatives:

- Add alt text to all images
- Use empty alt for decorative images
- Provide captions for videos
- Provide transcripts for audio
- Don't use images of text
- Describe complex images in detail
- Use SVG with proper titles and descriptions

## Focus management

Manage focus properly:

- Show clear focus indicators
- Move focus to modals when opened
- Return focus when modals close
- Don't remove focus outlines
- Use `:focus-visible` for keyboard-only focus
- Trap focus in modals
- Announce focus changes to screen readers

## Screen reader support

Optimize for screen readers:

- Use semantic HTML
- Provide text alternatives
- Use ARIA landmarks
- Announce dynamic content changes
- Provide skip links
- Test with multiple screen readers (NVDA, JAWS, VoiceOver)
- Use proper heading structure
- Avoid screen reader-only text when possible

## Responsive design

Make responsive designs accessible:

- Support text zoom up to 200%
- Don't break layout when zoomed
- Support mobile screen readers
- Make touch targets at least 44x44 pixels
- Support landscape and portrait orientations
- Don't disable zoom
- Test on mobile devices

## Testing accessibility

Test thoroughly:

- Use automated tools (axe, Lighthouse, WAVE)
- Test with keyboard only
- Test with screen readers
- Test with browser zoom
- Test with high contrast mode
- Get feedback from users with disabilities
- Include accessibility in code reviews
- Test on multiple devices and browsers
