import { Controller, Get } from '@nestjs/common';

@Controller('test')
export class TestController {
  @Get()
  healthCheck() {
    return { status: 'ok', message: 'Test endpoint is working!' };
  }
}
