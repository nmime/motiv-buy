export interface AuthUserData {
  id: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  first_name: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  last_name?: string;
  username?: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  language_code?: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  is_premium?: boolean;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  photo_url?: string;
}
