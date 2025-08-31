import { SourceParameters } from '../services/get-source-params.service';
import { LinkType } from './link-type.enum';

export interface RegexPattern {
  regex: RegExp;
  parse: (match: RegExpExecArray) => SourceParameters;
}

export const createRegexPatterns = (
  parseGeneric: (input: string, params?: SourceParameters) => SourceParameters,
): RegexPattern[] => [
  {
    regex: /(?:^|[_-])ref[_-]([^-]+)(.*)$/,
    parse: (match: RegExpExecArray) =>
      parseGeneric(
        match.input,
        new SourceParameters({
          linkType: LinkType.Referral,
          linkCode: match[1],
          refCode: match[1],
        }),
      ),
  },
  {
    regex: /(?:^|-)r[_-]([^-]+)(.*)$/,
    parse: (match: RegExpExecArray) =>
      parseGeneric(
        match.input,
        new SourceParameters({
          linkType: LinkType.Referral,
          linkCode: match[1],
          refCode: match[1],
        }),
      ),
  },
  {
    regex: /(?:^|-)camp_([^-]+)(.*)$/,
    parse: (match: RegExpExecArray) =>
      parseGeneric(
        match.input,
        new SourceParameters({
          linkType: LinkType.Campaign,
          linkCode: match[1],
          utmCampaign: match[1],
        }),
      ),
  },
  {
    regex: /(?:^|-)campaign_([^-]+)(.*)$/,
    parse: (match: RegExpExecArray) =>
      parseGeneric(
        match.input,
        new SourceParameters({
          linkType: LinkType.Campaign,
          linkCode: match[1],
          utmCampaign: match[1],
        }),
      ),
  },
  {
    regex: /(?:^|-)promo_([^-]+)(.*)$/,
    parse: (match: RegExpExecArray) =>
      parseGeneric(
        match.input,
        new SourceParameters({
          linkType: LinkType.Promo,
          linkCode: match[1],
          utmContent: match[1],
        }),
      ),
  },
  {
    regex: /(?:^|-)traffic_([^-]+)(.*)$/,
    parse: (match: RegExpExecArray) =>
      parseGeneric(
        match.input,
        new SourceParameters({
          linkType: LinkType.Traffic,
          linkCode: match[1],
          utmSource: 'traffic',
          utmMedium: match[1],
        }),
      ),
  },
  {
    regex: /(?:^|-)i_([^-]+)(.*)$/,
    parse: (match: RegExpExecArray) =>
      parseGeneric(
        match.input,
        new SourceParameters({
          linkType: LinkType.Invite,
          linkCode: match[1],
        }),
      ),
  },
  {
    regex: /(?:^|-)invite_([^-]+)(.*)$/,
    parse: (match: RegExpExecArray) =>
      parseGeneric(
        match.input,
        new SourceParameters({
          linkType: LinkType.Invite,
          linkCode: match[1],
        }),
      ),
  },
];