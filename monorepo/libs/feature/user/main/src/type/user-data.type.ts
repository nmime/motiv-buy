/**
 * User domain data types
 */

export interface CreateUserData {
  username?: string;
  firstName: string;
  lastName?: string;
  email?: string;
  telegramId: string;
  languageCode?: string;
  password?: string;
}

export interface UpdateUserData {
  firstName?: string;
  lastName?: string;
  username?: string;
}

export interface UserReferralData {
  count: number;
  earned: number;
  link: string;
  messageId?: string;
}

export interface UserData {
  id: string;
  name: string;
  username?: string;
  language?: string;
  referral: UserReferralData;
}
