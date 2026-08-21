import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentBranch = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const branchId = request.headers['x-branch-id'] || request.user?.activeBranchId;
    return branchId;
  },
);
