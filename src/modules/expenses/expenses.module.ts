import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { AuthModule } from '../../core/auth/auth.module';
import { BranchesModule } from '../../core/branches/branches.module';
import { ModulesModule } from '../../core/modules/modules.module';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { ExpenseCategoriesController } from './expense-categories.controller';
import { ExpenseCategoriesService } from './expense-categories.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    BranchesModule,
    ModulesModule,
  ],
  controllers: [
    ExpenseCategoriesController,
    ExpensesController,
  ],
  providers: [
    ExpensesService,
    ExpenseCategoriesService,
  ],
  exports: [
    ExpensesService,
    ExpenseCategoriesService,
  ],
})
export class ExpensesModule {}
