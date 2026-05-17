import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtGuard extends AuthGuard('jwt') {
  // Returns null instead of throwing 401 when no token is present
  handleRequest<TUser>(err: Error | null, user: TUser): TUser {
    return user;
  }

  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}
