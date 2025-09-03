import { SourceParameters } from '../service';
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
