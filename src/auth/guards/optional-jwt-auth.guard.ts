import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  // Override handleRequest so that it doesn't throw an error if the user is not found
  handleRequest(err, user, info) {
    return user || null;
  }
}
