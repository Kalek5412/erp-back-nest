import { Module } from '@nestjs/common';
import { TestController } from '../controller/test.controller';

@Module({
  controllers: [TestController],
})
export class TestModule {}
