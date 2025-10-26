import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const AuthUser = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const req: any = ctx.switchToHttp().getRequest();
  return req.user;
});
