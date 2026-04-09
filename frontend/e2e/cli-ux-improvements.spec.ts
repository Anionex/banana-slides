/**
 * E2E tests for CLI UX improvements:
 * - Short ID prefix matching
 * - Working project context (projects use/unuse)
 * - --pages parameter injection
 * - Plain-text --help output in pipe mode
 */

import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { test, expect } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:5062";
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CLI_CMD = `cd "${PROJECT_ROOT}" && uv run banana-cli --base-url ${BASE_URL} --json`;
const CLI_CMD_NO_JSON = `cd "${PROJECT_ROOT}" && uv run banana-cli --base-url ${BASE_URL}`;

function cli(args: string, timeout = 30000): any {
  const output = execSync(`${CLI_CMD} ${args}`, {
    encoding: "utf-8",
    timeout,
  });
  return JSON.parse(output.trim());
}

function cliRaw(args: string): string {
  return execSync(`${CLI_CMD_NO_JSON} ${args}`, {
    encoding: "utf-8",
    timeout: 30000,
  });
}

function cliHelp(args: string): string {
  // Help output goes to stdout in pipe mode (non-TTY)
  return execSync(
    `cd "${PROJECT_ROOT}" && uv run banana-cli ${args}`,
    {
      encoding: "utf-8",
      timeout: 30000,
    }
  );
}

test.describe("CLI Short ID Prefix Matching", () => {
  test.describe.configure({ mode: "serial", timeout: 120000 });
  let projectId: string;

  test.beforeAll(() => {
    const result = cli(
      'projects create --creation-type idea --idea-prompt "E2E test short ID"'
    );
    projectId = result.data?.project_id;
    expect(projectId).toBeTruthy();
  });

  test.afterAll(() => {
    try {
      cli(`projects delete ${projectId}`);
    } catch {
      // ignore cleanup errors
    }
  });

  test("should resolve project by short prefix", () => {
    const prefix = projectId.substring(0, 6);
    const result = cli(`projects get ${prefix}`);
    expect(result.success).toBe(true);
    expect(result.data?.idea_prompt).toBe("E2E test short ID");
  });

  test("should resolve project by full UUID", () => {
    const result = cli(`projects get ${projectId}`);
    expect(result.success).toBe(true);
    expect(result.data?.idea_prompt).toBe("E2E test short ID");
  });

  test("should error on no-match prefix", () => {
    try {
      cli("projects get zzzzzz");
      expect(true).toBe(false); // should not reach
    } catch (e: any) {
      expect(e.stderr || e.message).toContain("No project found");
    }
  });
});

test.describe("CLI Working Project Context", () => {
  test.describe.configure({ mode: "serial", timeout: 120000 });
  let projectId: string;

  test.beforeAll(() => {
    const result = cli(
      'projects create --creation-type idea --idea-prompt "E2E test context"'
    );
    projectId = result.data?.project_id;
    expect(projectId).toBeTruthy();
  });

  test.afterAll(() => {
    try {
      // Clear context and delete project
      cliRaw("projects unuse");
      cli(`projects delete ${projectId}`);
    } catch {
      // ignore cleanup errors
    }
  });

  test("should set and use working project", () => {
    // Set working project
    const useOutput = cliRaw(`projects use ${projectId}`);
    expect(useOutput).toContain("Working project set to:");

    // Show current working project
    const showOutput = cliRaw("projects use");
    expect(showOutput).toContain(projectId);
  });

  test("should clear working project", () => {
    // First set
    cliRaw(`projects use ${projectId}`);
    // Then clear
    const output = cliRaw("projects unuse");
    expect(output).toContain("cleared");

    // Verify cleared
    const showOutput = cliRaw("projects use");
    expect(showOutput).toContain("No working project set");
  });

  test("should use working project as fallback for workflows", () => {
    // Set working project
    cliRaw(`projects use ${projectId}`);

    // Now create an outline without --project-id
    // The outline generation call uses the working project
    const result = cli("workflows outline");
    expect(result.success).toBe(true);

    // Cleanup
    cliRaw("projects unuse");
  });
});

test.describe("CLI --pages Parameter", () => {
  test.describe.configure({ mode: "serial", timeout: 120000 });
  let projectId: string;

  test.beforeAll(() => {
    const result = cli(
      'projects create --creation-type idea --idea-prompt "E2E test pages param"'
    );
    projectId = result.data?.project_id;
    expect(projectId).toBeTruthy();
  });

  test.afterAll(() => {
    try {
      cli(`projects delete ${projectId}`);
    } catch {
      // ignore cleanup errors
    }
  });

  test("should accept --pages option in outline command", () => {
    // This test verifies the --pages parameter is accepted without error.
    // The actual page count depends on AI behavior, so we just verify
    // the API call succeeds and returns pages.
    const result = cli(
      `workflows outline --project-id ${projectId} --pages 3`,
      120000
    );
    expect(result.success).toBe(true);
    expect(result.data?.pages?.length).toBeGreaterThan(0);
  });
});

test.describe("CLI Plain-Text Help Output", () => {
  test("should produce plain-text help without Rich boxes in pipe mode", () => {
    const output = cliHelp("--help");
    // Should not contain Rich box-drawing characters
    expect(output).not.toContain("╭");
    expect(output).not.toContain("╰");
    // Should contain usage info
    expect(output.toLowerCase()).toContain("usage");
  });

  test("should show new commands in projects --help", () => {
    const output = cliHelp("projects --help");
    expect(output).toContain("use");
    expect(output).toContain("unuse");
  });

  test("should show --pages in workflows outline --help", () => {
    const output = cliHelp("workflows outline --help");
    expect(output).toContain("--pages");
  });
});
