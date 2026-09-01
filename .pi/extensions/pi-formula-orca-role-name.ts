import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const AUTOMATION_ROLES = [
  {
    promptMarker: "pi-formula issue coordinator",
    sessionName: "🚦 Issueコーディネータ",
  },
  {
    promptMarker: "pi-formula PR reviewer",
    sessionName: "🎛️ PRコーディネータ",
  },
] as const;

export default function (pi: ExtensionAPI) {
  pi.on("before_agent_start", (event) => {
    if (pi.getSessionName()) return;

    const role = AUTOMATION_ROLES.find(({ promptMarker }) =>
      event.prompt.includes(promptMarker),
    );
    if (role) pi.setSessionName(role.sessionName);
  });
}
