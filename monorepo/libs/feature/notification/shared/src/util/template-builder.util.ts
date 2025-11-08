import {
  NotificationTemplateEntity,
  NotificationContentType,
  NotificationButton,
  NotificationMedia,
} from '@app/database';
import { NotificationResult, BuildNotificationOptions } from '../type';
import { renderTemplate, renderButtons } from './template-renderer.util';

const DEFAULT_LOCALE = 'en';

interface LocalizedContent {
  text?: string | string[];
  media?: NotificationMedia | NotificationMedia[];
  buttons?: NotificationButton[][] | NotificationButton[][][];
}

function getLocalizedContent(template: NotificationTemplateEntity, locale: string): LocalizedContent {
  const normalizedLocale = locale || template.defaultLocale || DEFAULT_LOCALE;

  const textContent = template.text?.[normalizedLocale] ?? template.text?.[DEFAULT_LOCALE];
  const mediaContent = template.media?.[normalizedLocale] ?? template.media?.[DEFAULT_LOCALE];
  const buttonsContent = template.buttons?.[normalizedLocale] ?? template.buttons?.[DEFAULT_LOCALE];

  return {
    text: textContent,
    media: mediaContent,
    buttons: buttonsContent,
  };
}

function selectVariation(
  text: string | string[] | undefined,
  buttons: NotificationButton[][] | NotificationButton[][][] | undefined,
): { text?: string; buttons: NotificationButton[][] } {
  if (!text) {
    return { buttons: (buttons as NotificationButton[][]) ?? [] };
  }

  if (typeof text === 'string') {
    return {
      text,
      buttons: (buttons as NotificationButton[][]) ?? [],
    };
  }

  if (Array.isArray(text) && text.length > 0) {
    const randomIndex = Math.floor(Math.random() * text.length);
    const selectedText = text[randomIndex];

    let selectedButtons: NotificationButton[][] = [];
    if (buttons && Array.isArray(buttons) && buttons.length > 0) {
      if (buttons.length > randomIndex && Array.isArray(buttons[randomIndex])) {
        selectedButtons = buttons[randomIndex] as NotificationButton[][];
      } else {
        selectedButtons = buttons as NotificationButton[][];
      }
    }

    return {
      text: selectedText,
      buttons: selectedButtons,
    };
  }

  return { buttons: (buttons as NotificationButton[][]) ?? [] };
}

export function buildNotificationFromTemplate(
  template: NotificationTemplateEntity,
  options: BuildNotificationOptions,
): NotificationResult {
  const { locale, variables = {}, userContext } = options;

  const allVariables: Record<string, string | number> = {
    ...variables,
  };

  if (userContext) {
    allVariables.name = String(userContext.name ?? userContext.firstName ?? 'User');
    allVariables.username = String(userContext.username ?? userContext.name ?? 'User');
    allVariables.firstName = String(userContext.firstName ?? userContext.name ?? 'User');
    allVariables.lastName = String(userContext.lastName ?? '');

    for (const [key, value] of Object.entries(userContext)) {
      if (!allVariables[key] && value !== undefined && value !== null) {
        allVariables[key] = typeof value === 'string' || typeof value === 'number' ? value : String(value);
      }
    }
  }

  const content = getLocalizedContent(template, locale);
  const { text: selectedText, buttons: selectedButtons } = selectVariation(content.text, content.buttons);

  const result: NotificationResult = {
    contentType: template.contentType,
    isPersonal: template.isPersonal,
  };

  if (selectedText) {
    result.text = renderTemplate(selectedText, allVariables, template.templateEngine);
  }

  if (content.media) {
    if (Array.isArray(content.media)) {
      result.media = content.media.map((m) => ({
        ...m,
        caption: m.caption ? renderTemplate(m.caption, allVariables, template.templateEngine) : undefined,
      }));
    } else {
      result.media = {
        ...content.media,
        caption: content.media.caption
          ? renderTemplate(content.media.caption, allVariables, template.templateEngine)
          : undefined,
      };
    }
  }

  if (selectedButtons.length > 0) {
    result.buttons = renderButtons(selectedButtons, allVariables, template.templateEngine) as NotificationButton[][];
  }

  switch (template.contentType) {
    case NotificationContentType.Poll:
      if (template.pollConfig) {
        const pollData = template.pollConfig[locale] ?? template.pollConfig[DEFAULT_LOCALE];
        if (pollData) {
          result.pollConfig = {
            ...pollData,
            question: renderTemplate(pollData.question, allVariables, template.templateEngine),
            options: pollData.options.map((opt) => renderTemplate(opt, allVariables, template.templateEngine)),
            explanation: pollData.explanation
              ? renderTemplate(pollData.explanation, allVariables, template.templateEngine)
              : undefined,
          };
        }
      }
      break;

    case NotificationContentType.Location:
      if (template.locationConfig) {
        result.locationConfig = template.locationConfig[locale] ?? template.locationConfig[DEFAULT_LOCALE];
      }
      break;

    case NotificationContentType.Contact:
      if (template.contactConfig) {
        const contactData = template.contactConfig[locale] ?? template.contactConfig[DEFAULT_LOCALE];
        if (contactData) {
          result.contactConfig = {
            ...contactData,
            phoneNumber: renderTemplate(contactData.phoneNumber, allVariables, template.templateEngine),
            firstName: renderTemplate(contactData.firstName, allVariables, template.templateEngine),
            lastName: contactData.lastName
              ? renderTemplate(contactData.lastName, allVariables, template.templateEngine)
              : undefined,
          };
        }
      }
      break;

    case NotificationContentType.Venue:
      if (template.venueConfig) {
        const venueData = template.venueConfig[locale] ?? template.venueConfig[DEFAULT_LOCALE];
        if (venueData) {
          result.venueConfig = {
            ...venueData,
            title: renderTemplate(venueData.title, allVariables, template.templateEngine),
            address: renderTemplate(venueData.address, allVariables, template.templateEngine),
          };
        }
      }
      break;

    case NotificationContentType.Forward:
      if (template.forwardConfig) {
        result.forwardConfig = template.forwardConfig;
      }
      break;
  }

  if (template.extraConfig) {
    result.extra = template.extraConfig;
  }

  return result;
}
