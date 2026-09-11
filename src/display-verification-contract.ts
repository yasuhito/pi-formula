export interface DisplayVerificationOptions {
  corpus: string;
  theme: "light" | "dark";
  terminal: "ghostty" | "kitty";
  path: "image" | "text";
  extension: string;
  reflow: number | null;
  artifactsRoot: string;
}

export interface DisplayPlan {
  height: number;
  initialWidth: number;
  reflowWidth: number | null;
  imageRows: number;
  displayFormulas: number;
  failedFormulas: number;
}

export interface DisplayRunFiles {
  directory: string;
  session: string;
  cageLog: string;
  configHome: string;
  pathMarker: string;
  display: string;
  output: string;
  terminalConfig: string;
  runner: string;
  launcher: string;
  plan: string;
  protocol: string;
  result: string;
}
