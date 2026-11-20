// Cloudflare Worker: the clock for the P-Bandai bot.
//
// GitHub's own `schedule` trigger is best-effort and drops runs under load, so
// the workflow has no schedule. This Worker calls GitHub's workflow_dispatch
// API instead, which runs every time it is called.
//
// Setup (Workers & Pages -> your worker):
//   Settings -> Trigger events -> Cron:  */15 * * * *   (every 15 minutes)
//     After adding the cron, Deploy again. First fire can take up to an hour.
//   Settings -> Variables and Secrets:
//     GITHUB_REPO          Text    e.g. yourname/pbandai-restock-bot
//     GITHUB_PAT           Secret  fine-grained token, this one repo only,
//                                  permission "Actions: Read and write"
//     TELEGRAM_BOT_TOKEN   Secret  optional: alerts you if dispatch fails
//     TELEGRAM_CHAT_ID     Text    optional: where those alerts go
//
// Do NOT add a `fetch` handler: that would expose a public URL anyone could
// hit to trigger runs. "No fetch handler!" in the editor preview is expected.

const WORKFLOW = "check.yml";

export default {
  async scheduled(controller, env, ctx) {
    if (!env.GITHUB_REPO || !env.GITHUB_PAT) {
      console.log("GITHUB_REPO / GITHUB_PAT not set — nothing dispatched");
      return;
    }
    const res = await fetch(
      `https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/${WORKFLOW}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.GITHUB_PAT}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "pbandai-restock-trigger", // GitHub rejects requests without one
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref: "main" }),
      }
    );
    if (res.ok) return; // 204 No Content on success

    const detail = `${res.status} ${(await res.text()).slice(0, 300)}`;
    console.log(`dispatch failed: ${detail}`);

    // An expired PAT (401) silently stops the whole bot. Nag on Telegram, but
    // only on the first tick of each hour, not every 15 minutes.
    const minute = new Date(controller.scheduledTime).getUTCMinutes();
    if (minute < 15 && env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
      const hint = res.status === 401 ? "\nLikely cause: GITHUB_PAT expired. Make a new one and update the Worker secret." : "";
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text: `⚠️ P-Bandai bot trigger failed: ${detail}${hint}`,
        }),
      }).catch(e => console.log(`telegram alert failed: ${e}`));
    }
  },
};
