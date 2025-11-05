import { AlignTrueLogo } from "@aligntrue/ui";

const config = {
  logo: (
    <div className="flex items-center gap-2">
      <AlignTrueLogo size="md" />
      <span className="font-semibold">AlignTrue</span>
    </div>
  ),
  project: {
    link: "https://github.com/AlignTrue/aligntrue",
  },
  docsRepositoryBase:
    "https://github.com/AlignTrue/aligntrue/tree/main/apps/docs",
  footer: {
    content: `MIT ${new Date().getFullYear()} © AlignTrue.`,
  },
  search: {
    placeholder: "Search docs...",
  },
  toc: {
    title: "On this page",
  },
};

export default config;
