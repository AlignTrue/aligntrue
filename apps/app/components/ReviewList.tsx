"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { ReviewItem, ReviewItemType } from "./DetailPanel";

interface Section {
  id: ReviewItemType;
  title: string;
  items: ReviewItem[];
  collapsed?: boolean;
}

interface Props {
  sections: Section[];
  selectedItem: ReviewItem | null;
  onSelectItem: (item: ReviewItem) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: (sectionId: ReviewItemType) => void;
}

export function ReviewList({
  sections,
  selectedItem,
  onSelectItem,
  selectedIds,
  onToggleSelect,
  onSelectAll,
}: Props) {
  const [collapsedSections, setCollapsedSections] = useState<
    Set<ReviewItemType>
  >(() => new Set<ReviewItemType>(["processed"]));

  // Keyboard navigation
  const [focusIndex, setFocusIndex] = useState<number>(-1);

  const allItems = sections.flatMap((s) => s.items);
  const itemIndexById = useMemo(
    () => new Map(allItems.map((item, index) => [item.id, index])),
    [allItems],
  );
  const getItemByIndex = useCallback(
    (index: number) => (index >= 0 ? allItems.at(index) : undefined),
    [allItems],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case "j":
          e.preventDefault();
          setFocusIndex((prev) => Math.min(prev + 1, allItems.length - 1));
          break;
        case "k":
          e.preventDefault();
          setFocusIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          if (focusIndex >= 0 && getItemByIndex(focusIndex)) {
            e.preventDefault();
            const item = getItemByIndex(focusIndex);
            if (item) onSelectItem(item);
          }
          break;
        case "x":
          if (focusIndex >= 0 && getItemByIndex(focusIndex)) {
            e.preventDefault();
            const item = getItemByIndex(focusIndex);
            if (item) onToggleSelect(item.id);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [allItems, focusIndex, getItemByIndex, onSelectItem, onToggleSelect]);

  // Update focus when keyboard navigating
  useEffect(() => {
    const item = getItemByIndex(focusIndex);
    if (focusIndex >= 0 && item) {
      onSelectItem(item);
    }
  }, [focusIndex, getItemByIndex, onSelectItem]);

  const toggleSection = useCallback((sectionId: ReviewItemType) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  const getSectionIcon = (type: ReviewItemType) => {
    switch (type) {
      case "exception":
        return "🔴";
      case "needs_review":
        return "🟡";
      case "draft":
        return "📝";
      case "processed":
        return "✅";
    }
  };

  const getItemIcon = (item: ReviewItem) => {
    if (item.conversation?.channel === "email") return "📧";
    return "📋";
  };

  const getSafetyIndicator = (item: ReviewItem) => {
    if (item.safetyClass === "WRITE_EXTERNAL_SIDE_EFFECT") {
      return (
        <span className="text-amber-500" title="External action">
          ⚠️
        </span>
      );
    }
    return null;
  };

  return (
    <div className="space-y-3">
      {sections.map((section) => {
        const isCollapsed = collapsedSections.has(section.id);
        const sectionSelectedCount = section.items.filter((i) =>
          selectedIds.has(i.id),
        ).length;

        return (
          <Card key={section.id}>
            <CardHeader
              className="cursor-pointer select-none py-3"
              onClick={() => toggleSection(section.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>{getSectionIcon(section.id)}</span>
                  <CardTitle className="text-sm font-medium">
                    {section.title}
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    {section.items.length}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  {sectionSelectedCount > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {sectionSelectedCount} selected
                    </Badge>
                  )}
                  <span className="text-muted-foreground">
                    {isCollapsed ? "▸" : "▾"}
                  </span>
                </div>
              </div>
            </CardHeader>

            {!isCollapsed && (
              <CardContent className="pt-0">
                {section.items.length === 0 ? (
                  <p className="py-2 text-sm text-muted-foreground">
                    {section.id === "exception"
                      ? "No exceptions"
                      : section.id === "needs_review"
                        ? "Nothing needs review"
                        : section.id === "draft"
                          ? "No drafts ready"
                          : "No auto-processed items today"}
                  </p>
                ) : (
                  <div className="space-y-1">
                    {/* Select all for batch operations */}
                    {section.id !== "exception" && section.items.length > 1 && (
                      <div className="flex items-center gap-2 border-b pb-2 text-xs text-muted-foreground">
                        <Checkbox
                          checked={section.items.every((i) =>
                            selectedIds.has(i.id),
                          )}
                          onCheckedChange={() => onSelectAll(section.id)}
                        />
                        <span>Select all</span>
                      </div>
                    )}

                    {section.items.map((item) => {
                      const itemGlobalIndex = itemIndexById.get(item.id) ?? -1;
                      const isSelected = selectedItem?.id === item.id;
                      const isChecked = selectedIds.has(item.id);
                      const isFocused = focusIndex === itemGlobalIndex;

                      return (
                        <div
                          key={item.id}
                          className={`flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors ${
                            isSelected
                              ? "bg-accent"
                              : isFocused
                                ? "bg-accent/50"
                                : "hover:bg-muted/50"
                          }`}
                        >
                          {section.id !== "exception" && (
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => onToggleSelect(item.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          )}
                          <button
                            type="button"
                            className="flex flex-1 items-center gap-2 text-left"
                            onClick={() => onSelectItem(item)}
                          >
                            <span className="text-sm">{getItemIcon(item)}</span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm">{item.title}</p>
                              {item.subtitle && (
                                <p className="truncate text-xs text-muted-foreground">
                                  {item.subtitle}
                                </p>
                              )}
                            </div>
                            {getSafetyIndicator(item)}
                            {item.assessment && (
                              <span
                                className="text-xs text-muted-foreground"
                                title={`Confidence: ${(item.assessment.confidence * 100).toFixed(0)}%`}
                              >
                                {(item.assessment.confidence * 100).toFixed(0)}%
                              </span>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Keyboard shortcuts hint */}
      <div className="px-2 py-1 text-xs text-muted-foreground">
        <span className="font-mono">j</span>/
        <span className="font-mono">k</span> navigate •{" "}
        <span className="font-mono">x</span> select •{" "}
        <span className="font-mono">Enter</span> open
      </div>
    </div>
  );
}
