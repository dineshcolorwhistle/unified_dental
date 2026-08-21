import { SetMetadata } from '@nestjs/common';

export const REQUIRE_MODULE_KEY = 'requireModule';
export const RequireModule = (...modules: string[]) =>
  SetMetadata(REQUIRE_MODULE_KEY, modules);
