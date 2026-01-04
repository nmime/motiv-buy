/**
 * Private network IP addresses and CIDR blocks for internal network identification
 * These are RFC 1918 private address spaces and localhost addresses
 */
export const PrivateNetworkIps = [
  '127.0.0.1',
  '::1',
  // eslint-disable-next-line sonarjs/no-hardcoded-ip
  '10.0.0.0/8', // Private network range: 10.0.0.0 to 10.255.255.255
  // eslint-disable-next-line sonarjs/no-hardcoded-ip
  '172.16.0.0/12', // Private network range: 172.16.0.0 to 172.31.255.255
  // eslint-disable-next-line sonarjs/no-hardcoded-ip
  '192.168.0.0/16', // Private network range: 192.168.0.0 to 192.168.255.255
  'localhost',
] as const;
