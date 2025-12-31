import type { Config } from "tailwindcss";

const config: Config = {
  theme: {
    extend: {
      colors: {
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        destructive: "hsl(var(--destructive))",
      },
    },
  },
};

export default config;
