// Stub (T05). O02 replaces this file with the nightly pipeline dispatch (01:01 IST), the health report
// (07:31 IST) and the dead-man check. The cron expressions are in wrangler.jsonc; `controller.cron` says which fired.
export async function scheduled(
  controller: ScheduledController,
  _env: Cloudflare.Env,
  _ctx: ExecutionContext,
): Promise<void> {
  console.log(`scheduled: cron "${controller.cron}" fired; no jobs are wired up yet`);
}
