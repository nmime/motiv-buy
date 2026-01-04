import { RedisMode } from '../const';

export type RedisClusterConfig = {
  mode: RedisMode.Cluster;
  hosts: { host: string; port: number }[];
  password?: string;
};

export type RedisSentinelConfig = {
  mode: RedisMode.Sentinel;
  hosts: { host: string; port: number }[];
  sentinelGroupIdentifier: string;
  password?: string;
  db?: number;
};

export type RedisDefaultConfig = {
  mode: RedisMode.Default;
  hosts: { host: string; port: number }[];
  password?: string;
  db?: number;
};

export type RedisConfig = RedisClusterConfig | RedisSentinelConfig | RedisDefaultConfig;
