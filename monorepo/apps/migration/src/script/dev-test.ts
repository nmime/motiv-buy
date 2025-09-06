#!/usr/bin/env ts-node

/**
 * Development testing script
 * Quick validation of migration CLI functionality
 */

import { bootstrap } from '../migration-cli.bootstrap';

async function main() {
  console.log('🧪 Testing Migration CLI...');

  process.argv = ['node', 'migration-cli', 'status'];

  try {
    await bootstrap();
    console.log('✅ CLI test completed successfully');
  } catch (error) {
    console.error('❌ CLI test failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
