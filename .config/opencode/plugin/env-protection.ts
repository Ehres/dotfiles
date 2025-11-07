import type { Plugin } from "@opencode-ai/plugin";

export const EnvProtection: Plugin = async ({ $ }) => {
  return {
    "tool.execute.before": async (input, output) => {
      if (input.tool === "read") {
        // $`echo Read: ${output.args.filePath}`;
      }
      if (input.tool === "read" && output.args.filePath.includes(".env")) {
        throw new Error("Do not read .env files");
      }
    },
  };
};
