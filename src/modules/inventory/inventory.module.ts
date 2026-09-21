import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { AuthModule } from '../../core/auth/auth.module';
import { BranchesModule } from '../../core/branches/branches.module';
import { ModulesModule } from '../../core/modules/modules.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { InventoryCategoriesController } from './inventory-categories.controller';
import { InventoryCategoriesService } from './inventory-categories.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    BranchesModule,
    ModulesModule,
  ],
  controllers: [
    InventoryCategoriesController,
    InventoryController,
  ],
  providers: [
    InventoryService,
    InventoryCategoriesService,
  ],
  exports: [
    InventoryService,
    InventoryCategoriesService,
  ],
})
export class InventoryModule {}
