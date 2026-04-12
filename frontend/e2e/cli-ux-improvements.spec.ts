/**
 * E2E tests for CLI UX improvements:
 * - Short ID prefix matching
 * - Working project context (projects use/unuse)
 * - --pages parameter injection
 * - Plain-text --help output in pipe mode
 */

import { execSync, spawnSync } from "child_process";
import fs from "fs";
import os from "os";
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

function cliWithStderr(
  args: string,
  timeout = 30000
): { stdout: string; stderr: string; status: number | null } {
  const result = spawnSync("bash", ["-c", `${CLI_CMD} ${args}`], {
    encoding: "utf-8",
    timeout,
    cwd: PROJECT_ROOT,
  });
  return {
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    status: result.status,
  };
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

  test("should show --pages hint text in workflows outline --help", () => {
    const output = cliHelp("workflows outline --help");
    expect(output).toContain("--pages");
    expect(output).toContain("hint");
  });

  test("should show --output in exports pptx --help", () => {
    const output = cliHelp("exports pptx --help");
    expect(output).toContain("--output");
    expect(output).toContain("local path");
  });

  test("should show --wait/--no-wait in workflows images --help", () => {
    const output = cliHelp("workflows images --help");
    expect(output).toContain("--no-wait");
  });

  test("should show server-side filename help in exports pptx --help", () => {
    const output = cliHelp("exports pptx --help");
    expect(output).toContain("--filename");
    expect(output.toLowerCase()).toContain("server");
  });
});

test.describe("CLI --pages Hint Feedback", () => {
  test.describe.configure({ mode: "serial", timeout: 180000 });
  let projectId: string;

  test.beforeAll(() => {
    const result = cli(
      'projects create --creation-type idea --idea-prompt "A simple 2-slide deck about cats"'
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

  test("should print hint note on stderr when --pages is specified", () => {
    // Generate outline with --pages; AI may or may not match exactly.
    // We verify the stderr note mechanism works regardless of match.
    const result = cliWithStderr(
      `workflows outline --project-id ${projectId} --pages 3`,
      120000
    );
    expect(result.status).toBe(0);
    // stdout should be valid JSON
    const json = JSON.parse(result.stdout.trim());
    expect(json.success).toBe(true);
    const actualCount = json.data?.pages?.length || 0;
    expect(actualCount).toBeGreaterThan(0);
    // If count differs, stderr should contain the hint note
    if (actualCount !== 3) {
      expect(result.stderr).toContain("--pages=3 is a hint");
      expect(result.stderr).toContain(`Actual pages generated: ${actualCount}`);
    }
    // If count matches, no note is expected (both cases are valid)
  });
});

test.describe("CLI Export --output Auto-download", () => {
  test.describe.configure({ mode: "serial", timeout: 180000 });
  let projectId: string;
  let tmpDir: string;

  test.beforeAll(() => {
    // Create a project with pages (use seed helper)
    const seedScript = path.join(PROJECT_ROOT, "frontend/e2e/helpers/seed-project.ts");
    const seedOutput = execSync(
      `cd "${PROJECT_ROOT}" && npx tsx "${seedScript}" 2`,
      { encoding: "utf-8", timeout: 120000 }
    );
    // seed-project outputs "Project: <id>" line
    const match = seedOutput.match(/Project:\s*([a-f0-9-]+)/);
    expect(match).toBeTruthy();
    projectId = match![1];

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-export-"));
  });

  test.afterAll(() => {
    try {
      cli(`projects delete ${projectId}`);
    } catch {
      // ignore
    }
    try {
      fs.rmSync(tmpDir, { recursive: true });
    } catch {
      // ignore
    }
  });

  test("should download pptx to local path with --output", () => {
    const outputPath = path.join(tmpDir, "test.pptx");
    const result = cli(
      `exports pptx --project-id ${projectId} --output "${outputPath}"`,
      60000
    );
    expect(result.success).toBe(true);
    expect(result.data?.output_path).toBeTruthy();
    expect(fs.existsSync(outputPath)).toBe(true);
    const stat = fs.statSync(outputPath);
    expect(stat.size).toBeGreaterThan(0);
  });

  test("should return download URL without --output", () => {
    const result = cli(
      `exports pptx --project-id ${projectId}`,
      60000
    );
    expect(result.success).toBe(true);
    expect(result.data?.download_url).toBeTruthy();
  });

  test("should download pdf to local path with --output", () => {
    const outputPath = path.join(tmpDir, "test.pdf");
    const result = cli(
      `exports pdf --project-id ${projectId} --output "${outputPath}"`,
      60000
    );
    expect(result.success).toBe(true);
    expect(fs.existsSync(outputPath)).toBe(true);
  });
});

test.describe("CLI --wait Default Behavior", () => {
  test.describe.configure({ mode: "serial", timeout: 300000 });
  let projectId: string;

  test.beforeAll(() => {
    const result = cli(
      'projects create --creation-type idea --idea-prompt "Test wait default"'
    );
    projectId = result.data?.project_id;
    expect(projectId).toBeTruthy();
    // Generate outline first
    cli(`workflows outline --project-id ${projectId}`, 120000);
  });

  test.afterAll(() => {
    try {
      cli(`projects delete ${projectId}`);
    } catch {
      // ignore
    }
  });

  test("workflows descriptions should wait by default and print progress", () => {
    const result = cliWithStderr(
      `workflows descriptions --project-id ${projectId}`,
      180000
    );
    expect(result.status).toBe(0);
    const json = JSON.parse(result.stdout.trim());
    // Should return task result (waited), not just task_id
    expect(json.success).toBe(true);
    expect(json.data?.task).toBeTruthy();
    // stderr should contain progress lines
    expect(result.stderr).toContain("[PROGRESS]");
  });

  test("workflows descriptions --no-wait should return task_id immediately", () => {
    // Generate outline again to reset state
    cli(`workflows outline --project-id ${projectId}`, 120000);
    const result = cli(
      `workflows descriptions --project-id ${projectId} --no-wait`,
      30000
    );
    expect(result.success).toBe(true);
    expect(result.data?.task_id).toBeTruthy();
    // Should NOT have task result since we didn't wait
    expect(result.data?.task).toBeFalsy();
  });
});
