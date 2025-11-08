import { NotificationTemplateEngine } from '@app/database';

export function renderTemplate(
  template: string,
  variables: Record<string, string | number>,
  engine: NotificationTemplateEngine = NotificationTemplateEngine.Mustache,
): string {
  let result = template;

  for (const [key, value] of Object.entries(variables)) {
    const stringValue = String(value);

    switch (engine) {
      case NotificationTemplateEngine.Mustache:
        result = result.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), stringValue);
        break;

      case NotificationTemplateEngine.StringFormat:
        result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), stringValue);
        break;

      case NotificationTemplateEngine.Ejs:
        result = result.replace(new RegExp(`<%=\\s*${key}\\s*%>`, 'g'), stringValue);
        break;

      case NotificationTemplateEngine.Handlebars:
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), stringValue);
        break;

      default:
        result = result.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), stringValue);
    }
  }

  return result;
}

export function renderButtons(
  buttons: unknown[][],
  variables: Record<string, string | number>,
  engine: NotificationTemplateEngine = NotificationTemplateEngine.Mustache,
): unknown[][] {
  if (!buttons || buttons.length === 0) {
    return [];
  }

  return buttons.map((row) =>
    row.map((button) => {
      if (!button || typeof button !== 'object') {
        return button;
      }

      const btn = structuredClone(button) as Record<string, unknown>;
      const rendered: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(btn)) {
        if (typeof value === 'string') {
          rendered[key] = renderTemplate(value, variables, engine);
        } else {
          rendered[key] = value;
        }
      }

      return rendered;
    }),
  );
}
