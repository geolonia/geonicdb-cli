import { createProgram } from "./cli.js";
import { startUpdateCheck, printUpdateNotification } from "./update-notifier.js";

const updateCheckPromise = startUpdateCheck();
const program = createProgram();
await program.parseAsync();
const updateResult = await updateCheckPromise;
printUpdateNotification(updateResult);
