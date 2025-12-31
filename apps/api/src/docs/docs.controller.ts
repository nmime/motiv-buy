import { Controller, Get, Header } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { promises as fs } from 'fs';
import { join } from 'path';

/**
 * Documentation Controller
 *
 * Serves static HTML documentation for API integrations.
 * Available at /api/v1/docs/traffic-source
 */
@Controller('docs')
@ApiExcludeController()
export class DocsController {
  private trafficSourceDocsCache: string | null = null;

  /**
   * GET /docs/traffic-source - Traffic Source API Documentation
   */
  @Get('traffic-source')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  async getTrafficSourceDocs(): Promise<string> {
    if (this.trafficSourceDocsCache) {
      return this.trafficSourceDocsCache;
    }

    // Assets are copied to dist/apps/api/docs/ while controller is at dist/apps/api/src/docs/
    // Navigate up to dist/apps/api/ then into docs/
    const htmlPath = join(__dirname, '..', '..', 'docs', 'traffic-source-api.html');
    const html = await fs.readFile(htmlPath, 'utf-8');
    this.trafficSourceDocsCache = html;

    return html;
  }
}
