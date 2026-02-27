import pc from "picocolors";

type LogLevel = "debug" | "info" | "success" | "warn" | "error" | "step";

const LEVEL_PREFIX: Record<LogLevel, string> = {
  debug: pc.dim("[DBG]"),
  info: pc.blue("[INF]"),
  success: pc.green("[OK ]"),
  warn: pc.yellow("[WRN]"),
  error: pc.red("[ERR]"),
  step: pc.cyan("[>>>]"),
};

class Logger {
  private indent = 0;

  private format(level: LogLevel, msg: string): string {
    const pad = "  ".repeat(this.indent);
    return `${LEVEL_PREFIX[level]} ${pad}${msg}`;
  }

  debug(msg: string) {
    console.log(this.format("debug", pc.dim(msg)));
  }

  info(msg: string) {
    console.log(this.format("info", msg));
  }

  success(msg: string) {
    console.log(this.format("success", pc.green(msg)));
  }

  warn(msg: string) {
    console.warn(this.format("warn", pc.yellow(msg)));
  }

  error(msg: string, err?: Error) {
    console.error(this.format("error", pc.red(msg)));
    if (err?.stack) {
      console.error(pc.dim(err.stack));
    }
  }

  step(msg: string) {
    console.log(this.format("step", pc.bold(msg)));
  }

  group(label: string) {
    console.log(this.format("step", pc.bold(label)));
    this.indent++;
  }

  groupEnd() {
    if (this.indent > 0) this.indent--;
  }

  divider() {
    console.log(pc.dim("─".repeat(60)));
  }

  banner(title: string) {
    this.divider();
    console.log(pc.bold(pc.cyan(`  ${title}`)));
    this.divider();
  }
}

export const log = new Logger();
