import * as eta from 'eta';

export function renderTemplate(template: string, variables: Record<string, string | number>): string {
  return eta.render(template, variables) as string;
}

export function renderButtons(buttons: unknown[][], variables: Record<string, string | number>): unknown[][] {
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
          rendered[key] = renderTemplate(value, variables);
        } else {
          rendered[key] = value;
        }
      }

      return rendered;
    }),
  );
}
