import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../dto/api-response.dto';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((res) => {
        // If response already matches structure (has data or is raw file stream), return directly
        if (res && typeof res === 'object' && ('success' in res || res.isStream)) {
          return res;
        }

        // If response contains explicit data & meta
        if (res && typeof res === 'object' && 'data' in res && 'meta' in res) {
          return {
            success: true,
            data: res.data,
            meta: {
              ...res.meta,
              timestamp: new Date().toISOString(),
            },
          };
        }

        return {
          success: true,
          data: res,
          meta: {
            timestamp: new Date().toISOString(),
          },
        };
      }),
    );
  }
}
