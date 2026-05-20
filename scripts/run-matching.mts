// One-shot script to trigger the matching cycle
import { runFullMatchingCycle } from "../server/matchingEngine.js";

console.log("Starting matching cycle...");
const result = await runFullMatchingCycle();
console.log("Matching complete:", JSON.stringify(result, null, 2));
process.exit(0);
