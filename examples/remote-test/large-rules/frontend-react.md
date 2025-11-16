---
id: "large-rules/frontend-react"
version: "1.0.0"
spec_version: "1"
summary: "React component patterns and frontend best practices"
---

# Frontend React Development

## Component Structure

Organize components with clear structure:

- One component per file
- Use functional components with hooks
- Keep components small and focused (< 200 lines)
- Extract complex logic into custom hooks
- Co-locate styles with components
- Use index files for clean imports

Directory structure:

```
components/
  Button/
    Button.tsx
    Button.test.tsx
    Button.module.css
    index.ts
```

## State Management

Choose appropriate state management:

- Use useState for local component state
- Use useReducer for complex state logic
- Use Context API for app-wide state
- Consider Zustand or Redux for large apps
- Keep state as local as possible
- Lift state only when necessary

## Hooks Best Practices

Follow hooks rules and patterns:

- Only call hooks at the top level
- Only call hooks in React functions
- Use useEffect for side effects only
- Clean up effects with return functions
- Use dependency arrays correctly
- Extract reusable logic into custom hooks
- Memoize expensive computations with useMemo
- Memoize callbacks with useCallback

## Props and TypeScript

Type props properly:

- Define explicit prop types with TypeScript interfaces
- Use optional props with `?` notation
- Provide default values with destructuring
- Use children prop type for composition
- Avoid prop drilling (use composition or context)
- Document complex props with JSDoc comments

Example:

```typescript
interface ButtonProps {
  variant?: "primary" | "secondary";
  size?: "small" | "medium" | "large";
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

export function Button({
  variant = "primary",
  size = "medium",
  ...props
}: ButtonProps) {
  // Component implementation
}
```

## Component Composition

Use composition over inheritance:

- Build complex UIs from simple components
- Use children prop for flexible composition
- Create compound components for related UI elements
- Use render props or custom hooks for logic sharing
- Avoid deep prop drilling with composition
- Keep components decoupled and reusable

## Performance Optimization

Optimize React performance:

- Use React.memo for expensive components
- Memoize callbacks with useCallback
- Memoize computed values with useMemo
- Use lazy loading for code splitting
- Virtualize long lists with react-window
- Avoid inline object/array creation in JSX
- Profile with React DevTools before optimizing

## Forms and Validation

Handle forms properly:

- Use controlled components for form inputs
- Consider react-hook-form for complex forms
- Validate on blur and submit
- Show validation errors clearly
- Disable submit during submission
- Handle loading and error states
- Provide clear success feedback

## Error Boundaries

Implement error boundaries:

- Wrap components with error boundaries
- Show fallback UI for errors
- Log errors to monitoring service
- Provide recovery actions when possible
- Don't catch errors in event handlers (use try-catch)
- Test error boundary behavior

## Accessibility

Make components accessible:

- Use semantic HTML elements
- Add ARIA labels when needed
- Ensure keyboard navigation works
- Provide focus indicators
- Use sufficient color contrast
- Test with screen readers
- Support reduced motion preferences

## Testing Components

Test React components thoroughly:

- Use React Testing Library
- Test user interactions, not implementation
- Query by accessible roles and labels
- Mock external dependencies
- Test loading and error states
- Test keyboard interactions
- Aim for high coverage of critical paths

## Styling Approaches

Choose appropriate styling:

- CSS Modules for component-scoped styles
- Tailwind for utility-first approach
- Styled-components for CSS-in-JS
- Keep styles close to components
- Use CSS variables for theming
- Avoid inline styles except for dynamic values
- Follow consistent naming conventions

## Data Fetching

Handle data fetching properly:

- Use React Query or SWR for server state
- Show loading states during fetches
- Handle errors gracefully
- Implement retry logic
- Cache responses appropriately
- Prefetch data when possible
- Use suspense for data loading (when stable)

## Code Splitting

Implement code splitting:

- Use React.lazy for route-based splitting
- Split large components and libraries
- Use dynamic imports for conditional features
- Preload critical routes
- Monitor bundle sizes
- Use webpack bundle analyzer

## Routing

Implement routing properly:

- Use React Router for client-side routing
- Define routes declaratively
- Use nested routes for layouts
- Implement route guards for auth
- Handle 404 pages
- Use route parameters and query strings
- Implement breadcrumbs for navigation

## Environment Variables

Manage environment variables:

- Use REACT*APP* prefix for Create React App
- Use VITE\_ prefix for Vite
- Never commit secrets to git
- Use different .env files per environment
- Document required environment variables
- Validate env vars at startup
