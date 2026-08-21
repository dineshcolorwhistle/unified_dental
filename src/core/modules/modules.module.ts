import { Module } from '@nestjs/common';
import { ModulesService } from './modules.service';
import { ModulesController } from './modules.controller';
import { ModuleGuard } from './guards/module.guard';

@Module({
  controllers: [ModulesController],
  providers: [ModulesService, ModuleGuard],
  exports: [ModulesService, ModuleGuard],
})
export class ModulesModule {}
