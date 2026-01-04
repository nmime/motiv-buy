import { Controller, Get, Header } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { promises as fs } from 'fs';
import { join } from 'path';

/**
 * Documentation Controller
 *
 * Serves static HTML documentation for External API.
 * Available at /api/v1/docs/external/html
 */
@Controller('docs')
@ApiExcludeController()
export class DocsController {
  private externalDocsCache: string | null = null;

  /**
   * GET /docs/external/html - External API HTML Documentation
   */
  @Get('external/html')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  async getExternalDocs(): Promise<string> {
    if (this.externalDocsCache) {
      return this.externalDocsCache;
    }

    // Assets are copied to dist/apps/api/docs/ while controller is at dist/apps/api/src/docs/
    // Navigate up to dist/apps/api/ then into docs/
    const htmlPath = join(__dirname, '..', '..', 'docs', 'traffic-source-api.html');
    const html = await fs.readFile(htmlPath, 'utf-8');
    this.externalDocsCache = html;

    return html;
  }
}
