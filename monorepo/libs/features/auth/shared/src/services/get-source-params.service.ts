import { Injectable } from '@nestjs/common';
import { createRegexPatterns, LinkType } from '../const';

export class SourceParameters {
  utmSource?: string;
  utmCampaign?: string;
  utmMedium?: string;
  utmContent?: string;
  linkType?: LinkType;
  linkCode?: string;
  refCode?: string;

  constructor(partial?: Partial<SourceParameters>) {
    Object.assign(this, partial);
  }
}

@Injectable()
export class GetSourceParamsService {
  private readonly regexPatterns = createRegexPatterns(this.parseGeneric.bind(this));

  parseRequest(req?: string): SourceParameters | undefined {
    if (!req) {
      return undefined;
    }

    const trimmedReq = req.trim();
    for (const pattern of this.regexPatterns) {
      const regex = new RegExp(pattern.regex);
      const match = regex.exec(trimmedReq);
      if (match) {
        return pattern.parse(match);
      }
    }

    return this.parseGeneric(req);
  }

  private parseGeneric(input: string, params?: SourceParameters): SourceParameters {
    const result: SourceParameters = new SourceParameters(params);

    const usUcUmUctRegex = /(us|uc|um|uct|ref)_([^-]+)/g;
    let m: RegExpExecArray | null;
    while ((m = usUcUmUctRegex.exec(input)) !== null) {
      const [, prefix, value] = m;
      switch (prefix) {
        case 'us':
          result.utmSource = value;
          break;
        case 'uc':
          result.utmCampaign = value;
          break;
        case 'um':
          result.utmMedium = value;
          break;
        case 'uct':
          result.utmContent = value;
          break;
        case 'ref':
          result.refCode = value;
          result.linkType = LinkType.Referral;
          result.linkCode = value;
          break;
      }
    }

    if (!result.linkType && input) {
      result.linkType = LinkType.Direct;
      result.linkCode = input;
    }

    return result;
  }
}