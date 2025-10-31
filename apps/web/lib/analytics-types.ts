/**
 * Analytics event type definitions for catalog website
 * All events are privacy-focused and do not track PII
 */

export type AnalyticsEvent =
  | CatalogSearchEvent
  | CatalogFilterEvent
  | DetailViewEvent
  | ExporterTabSwitchEvent
  | CopyInstallCommandEvent
  | CopyExporterPreviewEvent
  | DownloadYamlEvent
  | ShareLinkCopyEvent;

export interface BaseEvent {
  timestamp: string;
  sessionId?: string;
}

export interface CatalogSearchEvent extends BaseEvent {
  type: "catalog_search";
  query: string;
  resultCount: number;
}

export interface CatalogFilterEvent extends BaseEvent {
  type: "catalog_filter";
  filterType: "status" | "namespace" | "tag";
  value: string;
}

export interface DetailViewEvent extends BaseEvent {
  type: "detail_view";
  packSlug: string;
  version: string;
}

export interface ExporterTabSwitchEvent extends BaseEvent {
  type: "exporter_tab_switch";
  packSlug: string;
  fromFormat?: string;
  toFormat: string;
}

export interface CopyInstallCommandEvent extends BaseEvent {
  type: "copy_install_command";
  packSlug: string;
  includesFromFlag: boolean;
}

export interface CopyExporterPreviewEvent extends BaseEvent {
  type: "copy_exporter_preview";
  packSlug: string;
  format: string;
}

export interface DownloadYamlEvent extends BaseEvent {
  type: "download_yaml";
  packSlug: string;
}

export interface ShareLinkCopyEvent extends BaseEvent {
  type: "share_link_copy";
  packSlug: string;
  url: string;
}
