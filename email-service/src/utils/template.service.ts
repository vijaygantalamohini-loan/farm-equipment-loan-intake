import fs from "fs/promises";
import path from "path";

export class TemplateService {
  private baseDir: string;

  constructor() {
    this.baseDir = path.resolve(process.cwd(), "src", "templates");
  }

  async loadTemplate(name: string, data: Record<string, unknown>): Promise<string> {
    const templatePath = this.resolveTemplatePath(name);
    const raw = await fs.readFile(templatePath, "utf-8");
    return this.render(raw, data || {});
  }

  private resolveTemplatePath(name: string): string {
    const normalized = name.replace(/^\/+/, "").replace(/\.+/g, "/");
    const fileName = normalized.endsWith(".html") ? normalized : `${normalized}.html`;
    return path.join(this.baseDir, fileName);
  }

  private render(template: string, data: Record<string, unknown>): string {
    return template.replace(/{{\s*([\w.]+)\s*}}/g, (_match, token) => {
      const value = this.resolveToken(data, token);
      if (value === null || value === undefined) {
        return "";
      }
      return String(value);
    });
  }

  private resolveToken(data: Record<string, unknown>, token: string): unknown {
    return token.split(".").reduce((acc, key) => {
      if (acc && typeof acc === "object" && key in acc) {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, data as unknown);
  }
}
