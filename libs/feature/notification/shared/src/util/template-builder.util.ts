import {
  NotificationButton,
  NotificationContentType,
  NotificationMedia,
  NotificationTemplateEntity,
} from '@app/database';
import { defaultLanguage } from '@app/common-shared';
import { BuildNotificationOptions, NotificationResult } from '../type';
import { renderButtons, renderTemplate } from './template-renderer.util';

interface LocalizedContent {
  text?: string | string[];
  media?: NotificationMedia | NotificationMedia[];
  buttons?: NotificationButton[][] | NotificationButton[][][];
}

function getLocalizedContent(template: NotificationTemplateEntity, locale: string): LocalizedContent {
  const normalizedLocale = locale || template.defaultLocale || defaultLanguage;

  const textContent = template.text?.[normalizedLocale] ?? template.text?.[defaultLanguage];
  const mediaContent = template.media?.[normalizedLocale] ?? template.media?.[defaultLanguage];
  const buttonsContent = template.buttons?.[normalizedLocale] ?? template.buttons?.[defaultLanguage];

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
    // eslint-disable-next-line sonarjs/pseudo-random
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

// eslint-disable-next-line sonarjs/cognitive-complexity
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
    result.text = renderTemplate(selectedText, allVariables);
  }

  if (content.media) {
    if (Array.isArray(content.media)) {
      result.media = content.media.map((m) => ({
        ...m,
        caption: m.caption ? renderTemplate(m.caption, allVariables) : undefined,
      }));
    } else {
      result.media = {
        ...content.media,
        caption: content.media.caption ? renderTemplate(content.media.caption, allVariables) : undefined,
      };
    }
  }

  if (selectedButtons.length > 0) {
    result.buttons = renderButtons(selectedButtons, allVariables) as NotificationButton[][];
  }

  switch (template.contentType) {
    case NotificationContentType.Poll:
      if (template.pollConfig) {
        const pollData = template.pollConfig[locale] ?? template.pollConfig[defaultLanguage];
        if (pollData) {
          result.pollConfig = {
            ...pollData,
            question: renderTemplate(pollData.question, allVariables),
            options: pollData.options.map((opt) => renderTemplate(opt, allVariables)),
            explanation: pollData.explanation ? renderTemplate(pollData.explanation, allVariables) : undefined,
          };
        }
      }

      break;

    case NotificationContentType.Location:
      if (template.locationConfig) {
        result.locationConfig = template.locationConfig[locale] ?? template.locationConfig[defaultLanguage];
      }

      break;

    case NotificationContentType.Contact:
      if (template.contactConfig) {
        const contactData = template.contactConfig[locale] ?? template.contactConfig[defaultLanguage];
        if (contactData) {
          result.contactConfig = {
            ...contactData,
            phoneNumber: renderTemplate(contactData.phoneNumber, allVariables),
            firstName: renderTemplate(contactData.firstName, allVariables),
            lastName: contactData.lastName ? renderTemplate(contactData.lastName, allVariables) : undefined,
          };
        }
      }

      break;

    case NotificationContentType.Venue:
      if (template.venueConfig) {
        const venueData = template.venueConfig[locale] ?? template.venueConfig[defaultLanguage];
        if (venueData) {
          result.venueConfig = {
            ...venueData,
            title: renderTemplate(venueData.title, allVariables),
            address: renderTemplate(venueData.address, allVariables),
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
