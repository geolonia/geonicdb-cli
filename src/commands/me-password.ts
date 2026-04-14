import type { Command } from "commander";
import { withErrorHandler, createClient } from "../helpers.js";
import { printSuccess, printError, printWarning } from "../output.js";
import { isInteractive, promptPassword } from "../prompt.js";
import { addExamples, addNotes } from "./help.js";

export function addMePasswordSubcommand(me: Command): void {
  const password = me
    .command("password")
    .description("Change your password")
    .option("--current-password <password>", "Current password (prompted if omitted)")
    .option("--new-password <password>", "New password (prompted if omitted)")
    .action(
      withErrorHandler(async (_opts: unknown, cmd: Command) => {
        const opts = cmd.opts() as {
          currentPassword?: string;
          newPassword?: string;
        };

        let currentPassword = opts.currentPassword;
        let newPassword = opts.newPassword;

        if (!currentPassword || !newPassword) {
          if (!isInteractive()) {
            printError(
              "Interactive terminal required for password prompts. " +
                "Use --current-password and --new-password flags in non-interactive mode.",
            );
            process.exit(1);
          }
        }

        if (!currentPassword) {
          currentPassword = await promptPassword("Current password");
        }
        if (!newPassword) {
          newPassword = await promptPassword("New password");
          const confirm = await promptPassword("Confirm new password");
          if (newPassword !== confirm) {
            printError("Passwords do not match.");
            process.exit(1);
          }
        }

        const client = createClient(cmd);
        await client.rawRequest("POST", "/me/password", {
          body: { currentPassword, newPassword },
        });

        printSuccess("Password changed.");
        printWarning("All existing tokens have been invalidated. Please log in again.");
      }),
    );

  addNotes(password, [
    "Passwords must be at least 12 characters long.",
    "After changing your password, all existing sessions are invalidated.",
  ]);

  addExamples(password, [
    {
      description: "Change password (interactive prompt)",
      command: "geonic me password",
    },
    {
      description: "Change password non-interactively",
      command: "geonic me password --current-password oldpass --new-password newpass123456",
    },
  ]);
}
