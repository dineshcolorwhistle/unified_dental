import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { AuthModule } from '../../core/auth/auth.module';
import { BranchesModule } from '../../core/branches/branches.module';
import { ModulesModule } from '../../core/modules/modules.module';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { ExpenseCategoriesController } from './expense-categories.controller';
import { ExpenseCategoriesService } from './expense-categories.service';
import { ExpenseSubcategoriesController } from './expense-subcategories.controller';
import { ExpenseSubcategoriesService } from './expense-subcategories.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    BranchesModule,
    ModulesModule,
  ],
  controllers: [
    ExpenseCategoriesController,
    ExpenseSubcategoriesController,
    ExpensesController,
  ],
  providers: [
    ExpensesService,
    ExpenseCategoriesService,
    ExpenseSubcategoriesService,
  ],
  exports: [
    ExpensesService,
    ExpenseCategoriesService,
    ExpenseSubcategoriesService,
  ],
})
export class ExpensesModule {}
