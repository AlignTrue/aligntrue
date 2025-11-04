# Archived: Catalog Website

**Archived:** November 4, 2025  
**Reason:** Simplification - unified to single Nextra docs site

## What Was Here

Full Next.js catalog website with:

- Discovery page with search and filters
- Pack detail pages with install flows
- Share functionality and analytics
- Search index generation
- 11 curated packs from `catalog/examples/`

## Why Archived

Pre-launch simplification to reduce complexity and maintenance overhead. The dual-app setup (web + docs) created:

- Deployment coordination issues
- Broken catalog build references
- Heavy pre-commit hooks
- Rewrite proxy complexity

## Restoration Triggers

Restore this catalog website when:

- **50+ active users** request catalog discovery UI, OR
- **20+ curated packs** exist and manual list becomes unwieldy, OR
- **User-generated pack sharing** becomes a priority feature

## Current Approach

Static catalog page in docs site at `/catalog/available-packs` with:

- Nextra card components for visual display
- Collapsible markdown table for alternative view
- Manual updates from `catalog/packs.yaml`

## Implementation Notes

If restoring:

1. Review archived code for reusable components
2. Consider unified app approach (docs + catalog in one Next.js app)
3. Simplify build pipeline (no separate search index generation)
4. See `potential_future_features.mdc` for detailed restoration plan

## Related Files

- Catalog data: `catalog/packs.yaml` and `catalog/examples/*.yaml`
- Build scripts: `scripts/catalog/build-catalog.ts` (still exists)
- Documentation: See archived docs in this directory
